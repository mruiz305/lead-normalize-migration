const config = require('../config');

const LOCATION_TYPES = [
  { id: 1, code: 'UNK', label: 'Unknown' },
  { id: 2, code: 'AFF', label: 'At-fault location' },
  { id: 3, code: 'COR', label: 'Corporate' },
];

function norm(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** UKN es typo legacy de UNK. */
function normalizeLocationCode(raw) {
  const s = norm(raw);
  if (!s) return 'UNK';
  const code = s.toUpperCase();
  if (code === 'UKN') return 'UNK';
  if (code === 'UNK' || code === 'AFF' || code === 'COR') return code;
  return null;
}

async function seedAccidentLocationTypes(targetConn) {
  const db = config.target.database;
  for (const row of LOCATION_TYPES) {
    await targetConn.query(
      `INSERT INTO \`${db}\`.ref_accident_location_type (id_location_type, type_code, type_label)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE type_label = VALUES(type_label)`,
      [row.id, row.code, row.label]
    );
  }
  return LOCATION_TYPES.length;
}

async function loadAccidentLocationTypeMap(targetConn) {
  const db = config.target.database;
  const byCode = new Map();
  for (const row of LOCATION_TYPES) {
    byCode.set(row.code, row.id);
  }

  const [rows] = await targetConn.query(
    `SELECT id_location_type, type_code FROM \`${db}\`.ref_accident_location_type`
  );
  for (const r of rows) {
    if (r.type_code) byCode.set(String(r.type_code).toUpperCase(), r.id_location_type);
  }

  function resolveAccidentLocationTypeId(raw) {
    const code = normalizeLocationCode(raw);
    if (!code) return { raw: norm(raw), id: null };
    const id = byCode.get(code) ?? null;
    return { raw: norm(raw), id, code };
  }

  return { byCode, resolveAccidentLocationTypeId, normalizeLocationCode };
}

async function relinkLeadAccidentLocationTypes(targetConn) {
  const db = config.target.database;
  const { byCode, normalizeLocationCode } = await loadAccidentLocationTypeMap(targetConn);

  const hasLegacy = await columnExists(targetConn, db, 'lead_accident', 'location_type');
  if (!hasLegacy) return 0;

  const [distinct] = await targetConn.query(`
    SELECT DISTINCT location_type FROM \`${db}\`.lead_accident
    WHERE location_type IS NOT NULL AND TRIM(location_type) <> ''
  `);

  for (const { location_type: raw } of distinct) {
    const code = normalizeLocationCode(raw);
    if (code && !byCode.has(code)) {
      throw new Error(`location_type sin catálogo: ${raw} → ${code}`);
    }
  }

  const [result] = await targetConn.query(`
    UPDATE \`${db}\`.lead_accident la
    SET la.id_location_type = CASE
      WHEN la.location_type IS NULL OR TRIM(la.location_type) = '' THEN 1
      WHEN UPPER(TRIM(la.location_type)) IN ('UNK', 'UKN') THEN 1
      WHEN UPPER(TRIM(la.location_type)) = 'AFF' THEN 2
      WHEN UPPER(TRIM(la.location_type)) = 'COR' THEN 3
      ELSE NULL
    END
    WHERE la.id_location_type IS NULL
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
  LOCATION_TYPES,
  seedAccidentLocationTypes,
  loadAccidentLocationTypeMap,
  normalizeLocationCode,
  relinkLeadAccidentLocationTypes,
};
