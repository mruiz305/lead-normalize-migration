/**
 * Catálogo plaza/mercado (g_users.SubOffice) → ref_sub_office.
 * Distinto de ref_company_office (oficina operativa).
 */
const config = require('../config');

function normSubOfficeCode(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

async function loadSubOfficeMapByCode(targetConn) {
  const db = config.target.database;
  const [rows] = await targetConn.query(
    `SELECT id_sub_office, sub_office_code FROM \`${db}\`.ref_sub_office WHERE is_active = 1`
  );
  const byCode = new Map();
  for (const r of rows) {
    const code = normSubOfficeCode(r.sub_office_code);
    if (code) byCode.set(code.toLowerCase(), Number(r.id_sub_office));
  }
  return byCode;
}

function resolveSubOfficeId(raw, byCode) {
  const code = normSubOfficeCode(raw);
  if (!code) return null;
  return byCode.get(code.toLowerCase()) ?? null;
}

/**
 * Inserta códigos faltantes desde DISTINCT g_users.SubOffice (prod).
 * No trunca: solo agrega.
 */
async function ensureSubOfficeCatalogFromGUsers(sourceConn, targetConn) {
  const src = config.source.database;
  const tgt = config.target.database;

  const [rows] = await sourceConn.query(`
    SELECT TRIM(SubOffice) AS code, COUNT(*) AS c
    FROM \`${src}\`.g_users
    WHERE SubOffice IS NOT NULL AND TRIM(SubOffice) <> ''
    GROUP BY TRIM(SubOffice)
    ORDER BY c DESC, code
  `);

  if (!rows.length) {
    return { sourceDistinct: 0, inserted: 0 };
  }

  const existing = await loadSubOfficeMapByCode(targetConn);
  const missing = rows.filter((r) => !existing.has(String(r.code).toLowerCase()));

  let inserted = 0;
  for (const r of missing) {
    const code = normSubOfficeCode(r.code);
    if (!code) continue;
    await targetConn.query(
      `INSERT INTO \`${tgt}\`.ref_sub_office (sub_office_code, display_name, is_active)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), is_active = 1`,
      [code, code]
    );
    inserted += 1;
  }

  return { sourceDistinct: rows.length, inserted };
}

module.exports = {
  normSubOfficeCode,
  loadSubOfficeMapByCode,
  resolveSubOfficeId,
  ensureSubOfficeCatalogFromGUsers,
};
