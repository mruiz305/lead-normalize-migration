const config = require('../config');
const { parseInjuryField, loadInjurySiteMap } = require('./injurySiteCatalog');
const { loadSeverityMap } = require('./severityLevelCatalog');

async function columnExists(conn, db, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [db, table, column]
  );
  return rows.length > 0;
}

async function linkLeadInsuranceToParty(targetConn) {
  const db = config.target.database;
  const [result] = await targetConn.query(`
    UPDATE \`${db}\`.lead_insurance li
    INNER JOIN \`${db}\`.lead_party lp
      ON lp.id_lead = li.id_lead
      AND lp.id_party_kind = 2
      AND lp.party_sequence = li.party_sequence
    SET li.id_lead_party = lp.id_lead_party
    WHERE li.insurance_role = 'PASSENGER'
      AND (li.id_lead_party IS NULL OR li.id_lead_party <> lp.id_lead_party)
  `);
  return result.affectedRows ?? 0;
}

async function relinkLeadPartyInjurySites(targetConn) {
  const db = config.target.database;
  if (!(await columnExists(targetConn, db, 'lead_party', 'injuries'))) {
    return 0;
  }

  const maps = await loadInjurySiteMap(targetConn);
  const [rows] = await targetConn.query(`
    SELECT id_lead_party, injuries FROM \`${db}\`.lead_party
    WHERE id_party_kind = 2
      AND injuries IS NOT NULL AND TRIM(injuries) <> ''
  `);

  const pending = [];
  for (const row of rows) {
    const { siteTokens } = parseInjuryField(row.injuries);
    for (const token of siteTokens) {
      pending.push({ id_lead_party: row.id_lead_party, token });
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
  for (const { id_lead_party, token } of pending) {
    const id = freshMaps.resolveInjurySiteId(token).id;
    if (id) pairs.add(`${id_lead_party}:${id}`);
  }

  if (!pairs.size) return 0;

  const values = [...pairs].map((p) => {
    const [id_lead_party, id_injury_site] = p.split(':');
    return [Number(id_lead_party), Number(id_injury_site)];
  });

  const chunk = 2000;
  let inserted = 0;
  for (let i = 0; i < values.length; i += chunk) {
    const slice = values.slice(i, i + chunk);
    const ph = slice.map(() => '(?,?)').join(',');
    const [res] = await targetConn.query(
      `INSERT IGNORE INTO \`${db}\`.lead_party_injury_site (id_lead_party, id_injury_site) VALUES ${ph}`,
      slice.flat()
    );
    inserted += res.affectedRows ?? 0;
  }
  return inserted;
}

async function backfillPartyPersonalSeverityFromInjuries(targetConn) {
  const db = config.target.database;
  if (!(await columnExists(targetConn, db, 'lead_party', 'injuries'))) return 0;

  const [rows] = await targetConn.query(`
    SELECT id_lead_party, injuries FROM \`${db}\`.lead_party
    WHERE id_party_kind = 2
      AND id_personal_severity IS NULL
      AND injuries IS NOT NULL AND TRIM(injuries) <> ''
  `);

  const sevMaps = await loadSeverityMap(targetConn);
  const updates = [];

  for (const row of rows) {
    const { siteTokens, severityFromInjury } = parseInjuryField(row.injuries);
    if (siteTokens.length || !severityFromInjury) continue;
    let id = sevMaps.resolveSeverityId(severityFromInjury).id;
    if (!id) id = await sevMaps.ensureSeverity(severityFromInjury);
    if (!id) continue;
    updates.push([id, row.id_lead_party]);
  }

  if (!updates.length) return 0;

  const chunk = 500;
  let updated = 0;
  for (let i = 0; i < updates.length; i += chunk) {
    const slice = updates.slice(i, i + chunk);
    const cases = slice.map(() => 'WHEN ? THEN ?').join(' ');
    const ids = slice.map(([, partyId]) => partyId);
    const params = slice.flatMap(([sevId, partyId]) => [partyId, sevId]);
    params.push(...ids);
    const [result] = await targetConn.query(
      `UPDATE \`${db}\`.lead_party
       SET id_personal_severity = CASE id_lead_party ${cases} END
       WHERE id_lead_party IN (${ids.map(() => '?').join(',')})`,
      params
    );
    updated += result.affectedRows ?? 0;
  }
  return updated;
}

async function dropLegacyPartyColumns(targetConn) {
  const db = config.target.database;
  let dropped = 0;
  for (const col of ['insurance', 'injuries']) {
    if (await columnExists(targetConn, db, 'lead_party', col)) {
      await targetConn.query(`ALTER TABLE \`${db}\`.lead_party DROP COLUMN \`${col}\``);
      dropped += 1;
    }
  }
  return dropped;
}

module.exports = {
  linkLeadInsuranceToParty,
  relinkLeadPartyInjurySites,
  backfillPartyPersonalSeverityFromInjuries,
  dropLegacyPartyColumns,
};
