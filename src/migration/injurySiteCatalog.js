const config = require('../config');
const { resolveSeverityCode, loadSeverityMap } = require('./severityLevelCatalog');

function norm(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function normalizeKey(name) {
  const s = norm(name);
  if (!s) return null;
  return s.toLowerCase().replace(/\s+/g, ' ');
}

function splitInjuryTokens(raw) {
  const text = norm(raw);
  if (!text) return [];
  return [...new Set(text.split(',').map((p) => p.trim()).filter(Boolean))];
}

/** Separa sitios anatómicos vs severidad mal ubicada en `injuries`. */
function parseInjuryField(raw) {
  const parts = splitInjuryTokens(raw);
  if (!parts.length) return { siteTokens: [], severityFromInjury: null };

  if (parts.length === 1) {
    const part = parts[0];
    const sev = resolveSeverityCode(part);
    if (sev !== undefined) {
      return { siteTokens: [], severityFromInjury: sev === null ? null : part };
    }
    return { siteTokens: [part], severityFromInjury: null };
  }

  const siteTokens = [];
  for (const part of parts) {
    const sev = resolveSeverityCode(part);
    if (sev !== undefined) continue;
    siteTokens.push(part);
  }
  return { siteTokens, severityFromInjury: null };
}

async function syncInjurySiteCatalog(sourceConn, targetConn, { truncate = true } = {}) {
  const tgtDb = config.target.database;

  if (truncate) {
    await targetConn.query('SET FOREIGN_KEY_CHECKS = 0');
    await targetConn.query(`TRUNCATE TABLE \`${tgtDb}\`.ref_injury_site`);
    await targetConn.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  const leadsSql = config.sourceLeads.sql;
  const leadsConn = config.sourceLeads.onTarget ? targetConn : sourceConn;
  const [rows] = await leadsConn.query(`
    SELECT DISTINCT val FROM (
      SELECT TRIM(injuries) AS val FROM ${leadsSql}
        WHERE injuries IS NOT NULL AND TRIM(injuries) <> ''
      UNION SELECT TRIM(psngr1Injuries) FROM ${leadsSql} WHERE psngr1Injuries IS NOT NULL AND TRIM(psngr1Injuries) <> ''
      UNION SELECT TRIM(psngr2Injuries) FROM ${leadsSql} WHERE psngr2Injuries IS NOT NULL AND TRIM(psngr2Injuries) <> ''
      UNION SELECT TRIM(psngr3Injuries) FROM ${leadsSql} WHERE psngr3Injuries IS NOT NULL AND TRIM(psngr3Injuries) <> ''
      UNION SELECT TRIM(psngr4Injuries) FROM ${leadsSql} WHERE psngr4Injuries IS NOT NULL AND TRIM(psngr4Injuries) <> ''
      UNION SELECT TRIM(psngr5Injuries) FROM ${leadsSql} WHERE psngr5Injuries IS NOT NULL AND TRIM(psngr5Injuries) <> ''
    ) u WHERE val IS NOT NULL
  `);

  const siteKeys = new Set();
  for (const { val } of rows) {
    const { siteTokens } = parseInjuryField(val);
    for (const token of siteTokens) {
      const nk = normalizeKey(token);
      if (nk) siteKeys.add(JSON.stringify({ token, nk }));
    }
  }

  let inserted = 0;
  for (const item of siteKeys) {
    const { token, nk } = JSON.parse(item);
    const [res] = await targetConn.query(
      `INSERT IGNORE INTO \`${tgtDb}\`.ref_injury_site (display_name, normalized_name)
       VALUES (?, ?)`,
      [token, nk]
    );
    inserted += res.affectedRows;
  }

  const [[{ total }]] = await targetConn.query(
    `SELECT COUNT(*) AS total FROM \`${tgtDb}\`.ref_injury_site`
  );
  console.log(`  ✓ ref_injury_site: ${inserted} nuevos (${total} total)`);
  return { inserted, total: Number(total) };
}

async function ensureInjurySite(targetConn, byKey, displayName) {
  const raw = norm(displayName);
  if (!raw) return null;
  const key = normalizeKey(raw);
  if (!key) return null;

  let id = byKey.get(key) ?? null;
  if (id) return id;

  const db = config.target.database;
  await targetConn.query(
    `INSERT INTO \`${db}\`.ref_injury_site (display_name, normalized_name)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
    [raw, key]
  );
  const [[row]] = await targetConn.query(
    `SELECT id_injury_site FROM \`${db}\`.ref_injury_site WHERE normalized_name = ? LIMIT 1`,
    [key]
  );
  id = row?.id_injury_site ?? null;
  if (id) byKey.set(key, id);
  return id;
}

async function loadInjurySiteMap(targetConn) {
  const db = config.target.database;
  const [rows] = await targetConn.query(
    `SELECT id_injury_site, display_name, normalized_name FROM \`${db}\`.ref_injury_site`
  );
  const byKey = new Map();
  for (const r of rows) {
    if (r.normalized_name) byKey.set(r.normalized_name, r.id_injury_site);
  }

  function resolveInjurySiteId(name) {
    const raw = norm(name);
    if (!raw) return { raw: null, id: null };
    const key = normalizeKey(raw);
    const id = byKey.get(key) ?? null;
    return { raw, id };
  }

  async function ensureInjurySiteForName(name) {
    return ensureInjurySite(targetConn, byKey, name);
  }

  return {
    byKey,
    parseInjuryField,
    resolveInjurySiteId,
    ensureInjurySite: ensureInjurySiteForName,
  };
}

async function relinkLeadInjurySites(targetConn) {
  const db = config.target.database;
  const maps = await loadInjurySiteMap(targetConn);

  if (!(await columnExists(targetConn, db, 'lead_injury', 'injuries'))) {
    return 0;
  }

  const [rows] = await targetConn.query(
    `SELECT id_lead, injuries FROM \`${db}\`.lead_injury
     WHERE injuries IS NOT NULL AND TRIM(injuries) <> ''`
  );

  const pending = [];
  for (const row of rows) {
    const { siteTokens } = parseInjuryField(row.injuries);
    for (const token of siteTokens) {
      pending.push({ id_lead: row.id_lead, token });
    }
  }

  const uniqueTokens = [...new Set(pending.map((p) => p.token))];
  for (const token of uniqueTokens) {
    if (!maps.resolveInjurySiteId(token).id) {
      await maps.ensureInjurySite(token);
    }
  }

  const freshMaps = await loadInjurySiteMap(targetConn);
  const pairs = new Set();
  for (const { id_lead, token } of pending) {
    const id = freshMaps.resolveInjurySiteId(token).id;
    if (id) pairs.add(`${id_lead}:${id}`);
  }

  if (!pairs.size) return 0;

  const values = [...pairs].map((p) => {
    const [id_lead, id_injury_site] = p.split(':');
    return [Number(id_lead), Number(id_injury_site)];
  });

  const chunk = 2000;
  let inserted = 0;
  for (let i = 0; i < values.length; i += chunk) {
    const slice = values.slice(i, i + chunk);
    const ph = slice.map(() => '(?,?)').join(',');
    const [res] = await targetConn.query(
      `INSERT IGNORE INTO \`${db}\`.lead_injury_site (id_lead, id_injury_site) VALUES ${ph}`,
      slice.flat()
    );
    inserted += res.affectedRows ?? 0;
  }
  return inserted;
}

async function backfillPersonalSeverityFromInjuries(targetConn) {
  const db = config.target.database;
  if (!(await columnExists(targetConn, db, 'lead_injury', 'injuries'))) return 0;

  const [rows] = await targetConn.query(
    `SELECT li.id_lead, li.injuries, la.id_personal_severity
     FROM \`${db}\`.lead_injury li
     INNER JOIN \`${db}\`.lead_accident la ON la.id_lead = li.id_lead
     WHERE li.injuries IS NOT NULL AND TRIM(li.injuries) <> ''
       AND la.id_personal_severity IS NULL`
  );

  const sevMaps = await loadSeverityMap(targetConn);
  let updated = 0;

  for (const row of rows) {
    const { siteTokens, severityFromInjury } = parseInjuryField(row.injuries);
    if (siteTokens.length || !severityFromInjury) continue;
    let id = sevMaps.resolveSeverityId(severityFromInjury).id;
    if (!id) id = await sevMaps.ensureSeverity(severityFromInjury);
    if (!id) continue;
    await targetConn.query(
      `UPDATE \`${db}\`.lead_accident SET id_personal_severity = ? WHERE id_lead = ?`,
      [id, row.id_lead]
    );
    updated += 1;
  }
  return updated;
}

async function pruneEmptyLeadInjury(targetConn) {
  const db = config.target.database;
  const [result] = await targetConn.query(`
    DELETE li FROM \`${db}\`.lead_injury li
    WHERE (li.hospital_name IS NULL OR TRIM(li.hospital_name) = '')
      AND li.fracture = 0 AND li.ambulance = 0 AND li.hospital = 0
      AND li.xray = 0 AND li.mri = 0 AND li.ct_scans = 0
      AND NOT EXISTS (
        SELECT 1 FROM \`${db}\`.lead_injury_site lis WHERE lis.id_lead = li.id_lead
      )
  `);
  return result.affectedRows ?? 0;
}

async function columnExists(conn, db, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [db, table, column]
  );
  return rows.length > 0;
}

module.exports = {
  parseInjuryField,
  splitInjuryTokens,
  syncInjurySiteCatalog,
  loadInjurySiteMap,
  ensureInjurySite,
  relinkLeadInjurySites,
  backfillPersonalSeverityFromInjuries,
  pruneEmptyLeadInjury,
};
