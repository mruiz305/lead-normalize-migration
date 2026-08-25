const config = require('../config');

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

async function syncAtFaultTypeCatalog(sourceConn, targetConn, { truncate = true } = {}) {
  const srcDb = config.source.database;
  const tgtDb = config.target.database;

  if (truncate) {
    await targetConn.query('SET FOREIGN_KEY_CHECKS = 0');
    await targetConn.query(`TRUNCATE TABLE \`${tgtDb}\`.ref_at_fault_type`);
    await targetConn.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  const [prodRows] = await sourceConn.query(`
    SELECT idAtFaultType, atFaultType
    FROM \`${srcDb}\`.refAtFaultTypes
    ORDER BY idAtFaultType
  `);

  let fromProd = 0;
  for (const r of prodRows) {
    const name = norm(r.atFaultType);
    const nk = normalizeKey(name);
    if (!nk) continue;
    await targetConn.query(
      `INSERT INTO \`${tgtDb}\`.ref_at_fault_type
         (id_at_fault_type, display_name, normalized_name)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
      [r.idAtFaultType, name, nk]
    );
    fromProd += 1;
  }

  const leadsSql = config.sourceLeads.sql;
  const leadsConn = config.sourceLeads.onTarget ? targetConn : sourceConn;
  const [leadRows] = await leadsConn.query(`
    SELECT DISTINCT val FROM (
      SELECT TRIM(atFaultType) AS val FROM ${leadsSql}
        WHERE atFaultType IS NOT NULL AND TRIM(atFaultType) <> ''
      UNION SELECT TRIM(atFaultSubType) FROM ${leadsSql}
        WHERE atFaultSubType IS NOT NULL AND TRIM(atFaultSubType) <> ''
    ) u WHERE val IS NOT NULL
  `);

  let fromLeads = 0;
  for (const { val } of leadRows) {
    const nk = normalizeKey(val);
    if (!nk) continue;
    const [res] = await targetConn.query(
      `INSERT IGNORE INTO \`${tgtDb}\`.ref_at_fault_type (display_name, normalized_name)
       VALUES (?, ?)`,
      [val, nk]
    );
    fromLeads += res.affectedRows;
  }

  const [[{ total }]] = await targetConn.query(
    `SELECT COUNT(*) AS total FROM \`${tgtDb}\`.ref_at_fault_type`
  );
  console.log(`  ✓ ref_at_fault_type: prod ${fromProd} + leads ${fromLeads} (${total} total)`);
  return { fromProd, fromLeads, total: Number(total) };
}

async function ensureAtFaultType(targetConn, byKey, name) {
  const raw = norm(name);
  if (!raw) return null;
  const key = normalizeKey(raw);
  if (!key) return null;

  let id = byKey.get(key) ?? null;
  if (id) return id;

  const db = config.target.database;
  await targetConn.query(
    `INSERT INTO \`${db}\`.ref_at_fault_type (display_name, normalized_name)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
    [raw, key]
  );
  const [[row]] = await targetConn.query(
    `SELECT id_at_fault_type FROM \`${db}\`.ref_at_fault_type WHERE normalized_name = ? LIMIT 1`,
    [key]
  );
  id = row?.id_at_fault_type ?? null;
  if (id) byKey.set(key, id);
  return id;
}

async function loadAtFaultTypeMap(targetConn) {
  const db = config.target.database;
  const [rows] = await targetConn.query(
    `SELECT id_at_fault_type, display_name, normalized_name FROM \`${db}\`.ref_at_fault_type`
  );
  const byKey = new Map();
  for (const r of rows) {
    if (r.normalized_name) byKey.set(r.normalized_name, r.id_at_fault_type);
  }

  function resolveAtFaultTypeId(name) {
    const raw = norm(name);
    if (!raw) return { raw: null, id: null };
    const key = normalizeKey(raw);
    const id = byKey.get(key) ?? null;
    return { raw, id };
  }

  async function ensureAtFaultTypeForName(name) {
    return ensureAtFaultType(targetConn, byKey, name);
  }

  return { byKey, resolveAtFaultTypeId, ensureAtFaultType: ensureAtFaultTypeForName };
}

async function relinkLeadAccidentAtFaultTypes(targetConn) {
  const db = config.target.database;
  const maps = await loadAtFaultTypeMap(targetConn);

  for (const [col, idCol] of [
    ['at_fault_type', 'id_at_fault_type'],
    ['at_fault_sub_type', 'id_at_fault_sub_type'],
  ]) {
    if (!(await columnExists(targetConn, db, 'lead_accident', col))) continue;

    const [missing] = await targetConn.query(`
      SELECT DISTINCT la.\`${col}\` AS raw_val
      FROM \`${db}\`.lead_accident la
      LEFT JOIN \`${db}\`.ref_at_fault_type r
        ON r.normalized_name = LOWER(TRIM(REGEXP_REPLACE(la.\`${col}\`, '[[:space:]]+', ' ')))
      WHERE la.\`${col}\` IS NOT NULL AND TRIM(la.\`${col}\`) <> ''
        AND r.id_at_fault_type IS NULL
    `);
    for (const row of missing) {
      await maps.ensureAtFaultType(row.raw_val);
    }

    await targetConn.query(`
      UPDATE \`${db}\`.lead_accident la
      INNER JOIN \`${db}\`.ref_at_fault_type r
        ON r.normalized_name = LOWER(TRIM(REGEXP_REPLACE(la.\`${col}\`, '[[:space:]]+', ' ')))
      SET la.\`${idCol}\` = r.id_at_fault_type
      WHERE la.\`${col}\` IS NOT NULL AND TRIM(la.\`${col}\`) <> ''
    `);
  }

  return maps.byKey.size;
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
  syncAtFaultTypeCatalog,
  loadAtFaultTypeMap,
  normalizeKey,
  ensureAtFaultType,
  relinkLeadAccidentAtFaultTypes,
};
