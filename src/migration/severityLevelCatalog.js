const config = require('../config');

const SEVERITY_SEED = [
  { id: 1, code: 'MILD', label: 'Mild', sort: 1 },
  { id: 2, code: 'MODERATE', label: 'Moderate', sort: 2 },
  { id: 3, code: 'HIGH', label: 'High', sort: 3 },
  { id: 4, code: 'MAJOR', label: 'Major', sort: 4 },
];

/** Texto prod → código canónico; null = sin severidad (N/A, vacío). */
const ALIAS_TO_CODE = new Map([
  ['mild', 'MILD'],
  ['1', 'MILD'],
  ['moderate', 'MODERATE'],
  ['mod', 'MODERATE'],
  ['2', 'MODERATE'],
  ['high', 'HIGH'],
  ['3', 'HIGH'],
  ['major', 'MAJOR'],
  ['n/a', null],
  ['na', null],
  ['-', null],
  ['none', null],
]);

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

function resolveSeverityCode(raw) {
  const key = normalizeKey(raw);
  if (!key) return null;
  if (ALIAS_TO_CODE.has(key)) return ALIAS_TO_CODE.get(key);
  if (SEVERITY_SEED.some((s) => s.code.toLowerCase() === key)) {
    return key.toUpperCase();
  }
  return undefined;
}

async function seedSeverityLevels(targetConn) {
  const db = config.target.database;
  for (const row of SEVERITY_SEED) {
    await targetConn.query(
      `INSERT INTO \`${db}\`.ref_severity_level
         (id_severity, severity_code, severity_label, sort_order, normalized_name)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE severity_label = VALUES(severity_label)`,
      [row.id, row.code, row.label, row.sort, row.code.toLowerCase()]
    );
  }
  return SEVERITY_SEED.length;
}

async function syncSeverityFromLeads(sourceConn, targetConn) {
  const tgtDb = config.target.database;
  const leadsSql = config.sourceLeads.sql;
  const leadsConn = config.sourceLeads.onTarget ? targetConn : sourceConn;
  const [rows] = await leadsConn.query(`
    SELECT DISTINCT val FROM (
      SELECT TRIM(propertyDamage) AS val FROM ${leadsSql}
        WHERE propertyDamage IS NOT NULL AND TRIM(propertyDamage) <> ''
      UNION SELECT TRIM(personalInjury) FROM ${leadsSql}
        WHERE personalInjury IS NOT NULL AND TRIM(personalInjury) <> ''
    ) u WHERE val IS NOT NULL
  `);

  let added = 0;
  for (const { val } of rows) {
    const code = resolveSeverityCode(val);
    if (code === null || code === undefined) {
      const nk = normalizeKey(val);
      if (!nk) continue;
      const newId = await nextSeverityId(targetConn);
      const [res] = await targetConn.query(
        `INSERT IGNORE INTO \`${tgtDb}\`.ref_severity_level
           (id_severity, severity_code, severity_label, sort_order, normalized_name)
         VALUES (?, ?, ?, 99, ?)`,
        [newId, val.slice(0, 20).toUpperCase().replace(/\s+/g, '_'), val, nk]
      );
      added += res.affectedRows;
    }
  }
  return added;
}

async function nextSeverityId(targetConn) {
  const db = config.target.database;
  const [[{ maxId }]] = await targetConn.query(
    `SELECT COALESCE(MAX(id_severity), 0) AS maxId FROM \`${db}\`.ref_severity_level`
  );
  return Number(maxId) + 1;
}

async function ensureSeverity(targetConn, byKey, byCode, raw) {
  const text = norm(raw);
  if (!text) return null;

  const code = resolveSeverityCode(text);
  if (code === null) return null;
  if (code && byCode.has(code)) return byCode.get(code);

  const key = normalizeKey(text);
  if (key && byKey.has(key)) return byKey.get(key);

  const db = config.target.database;
  const severityCode = code ?? text.slice(0, 20).toUpperCase().replace(/\s+/g, '_');
  const newId = await nextSeverityId(targetConn);
  await targetConn.query(
    `INSERT INTO \`${db}\`.ref_severity_level
       (id_severity, severity_code, severity_label, sort_order, normalized_name)
     VALUES (?, ?, ?, 99, ?)
     ON DUPLICATE KEY UPDATE severity_label = VALUES(severity_label)`,
    [newId, severityCode, text, key ?? severityCode.toLowerCase()]
  );
  const [[row]] = await targetConn.query(
    `SELECT id_severity, severity_code, normalized_name FROM \`${db}\`.ref_severity_level
     WHERE normalized_name = ? OR severity_code = ? LIMIT 1`,
    [key ?? severityCode.toLowerCase(), severityCode]
  );
  if (row) {
    if (row.normalized_name) byKey.set(row.normalized_name, row.id_severity);
    byCode.set(row.severity_code, row.id_severity);
    return row.id_severity;
  }
  return null;
}

async function loadSeverityMap(targetConn) {
  const db = config.target.database;
  const [rows] = await targetConn.query(
    `SELECT id_severity, severity_code, severity_label, normalized_name
     FROM \`${db}\`.ref_severity_level`
  );
  const byKey = new Map();
  const byCode = new Map();
  for (const r of rows) {
    byCode.set(r.severity_code, r.id_severity);
    if (r.normalized_name) byKey.set(r.normalized_name, r.id_severity);
    byKey.set(r.severity_code.toLowerCase(), r.id_severity);
    byKey.set(r.severity_label.toLowerCase(), r.id_severity);
  }

  function resolveSeverityId(raw) {
    const text = norm(raw);
    if (!text) return { raw: null, id: null };
    const code = resolveSeverityCode(text);
    if (code === null) return { raw: text, id: null };
    if (code && byCode.has(code)) return { raw: text, id: byCode.get(code) };
    const key = normalizeKey(text);
    const id = key ? byKey.get(key) ?? null : null;
    return { raw: text, id };
  }

  async function ensureSeverityForRaw(raw) {
    return ensureSeverity(targetConn, byKey, byCode, raw);
  }

  return { byKey, byCode, resolveSeverityId, ensureSeverity: ensureSeverityForRaw, resolveSeverityCode };
}

async function relinkLeadAccidentSeverity(targetConn) {
  const db = config.target.database;
  const maps = await loadSeverityMap(targetConn);

  const caseExpr = `
    CASE
      WHEN \`col\` IS NULL OR TRIM(\`col\`) = '' THEN NULL
      WHEN LOWER(TRIM(\`col\`)) IN ('n/a', 'na', '-', 'none') THEN NULL
      WHEN LOWER(TRIM(\`col\`)) IN ('mild', '1') THEN 1
      WHEN LOWER(TRIM(\`col\`)) IN ('moderate', 'mod', '2') THEN 2
      WHEN LOWER(TRIM(\`col\`)) IN ('high', '3') THEN 3
      WHEN LOWER(TRIM(\`col\`)) = 'major' THEN 4
      ELSE NULL
    END`;

  for (const [col, idCol] of [
    ['property_damage', 'id_property_severity'],
    ['personal_injury', 'id_personal_severity'],
  ]) {
    if (!(await columnExists(targetConn, db, 'lead_accident', col))) continue;

    await targetConn.query(`
      UPDATE \`${db}\`.lead_accident
      SET \`${idCol}\` = ${caseExpr.replace(/`col`/g, `\`${col}\``)}
    `);

    const [missing] = await targetConn.query(`
      SELECT DISTINCT \`${col}\` AS raw_val
      FROM \`${db}\`.lead_accident
      WHERE \`${col}\` IS NOT NULL AND TRIM(\`${col}\`) <> ''
        AND \`${idCol}\` IS NULL
    `);
    for (const { raw_val: raw } of missing) {
      const id = await maps.ensureSeverity(raw);
      if (id) {
        await targetConn.query(
          `UPDATE \`${db}\`.lead_accident SET \`${idCol}\` = ? WHERE \`${col}\` = ? AND \`${idCol}\` IS NULL`,
          [id, raw]
        );
      }
    }
  }

  return maps.byCode.size;
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
  SEVERITY_SEED,
  seedSeverityLevels,
  syncSeverityFromLeads,
  loadSeverityMap,
  resolveSeverityCode,
  ensureSeverity,
  relinkLeadAccidentSeverity,
};
