const config = require('../config');

function normOfficeCode(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s.toUpperCase();
}

async function loadCompanyOfficeMap(targetConn) {
  const db = config.target.database;
  const [rows] = await targetConn.query(
    `SELECT id_company_office, office_code FROM \`${db}\`.ref_company_office WHERE is_active = 1`
  );
  const companyOfficeByCode = new Map();
  for (const r of rows) {
    const code = normOfficeCode(r.office_code);
    if (code && !companyOfficeByCode.has(code)) {
      companyOfficeByCode.set(code, r.id_company_office);
    }
  }
  return { companyOfficeByCode, resolveCompanyOfficeId: (code) => {
    const k = normOfficeCode(code);
    return k ? companyOfficeByCode.get(k) ?? null : null;
  } };
}

/**
 * After copying tblCompanyOffices, add office codes used in g_users.office
 * that are missing from ref_company_office (e.g. 1800, CFL-LBA, CHI-AND, COL).
 * Skips COR * clinic labels (not part of the marketing Office filter).
 * Allocates new id_company_office above MAX(existing).
 */
async function appendMissingOfficesFromGUsers(sourceConn, targetConn, { defaultCompanyId } = {}) {
  const src = config.source.database;
  const tgt = config.target.database;

  const [existing] = await targetConn.query(
    `SELECT id_company_office, office_code FROM \`${tgt}\`.ref_company_office`,
  );
  const byCode = new Set(
    existing.map((r) => normOfficeCode(r.office_code)).filter(Boolean),
  );
  let maxId = existing.reduce(
    (m, r) => Math.max(m, Number(r.id_company_office) || 0),
    0,
  );

  let companyId = defaultCompanyId != null ? Number(defaultCompanyId) : null;
  if (!companyId) {
    const [companyRows] = await targetConn.query(
      `SELECT id_company FROM \`${tgt}\`.ref_company ORDER BY id_company LIMIT 1`,
    );
    companyId = Number(companyRows[0]?.id_company) || 1;
  }

  const [rows] = await sourceConn.query(`
    SELECT TRIM(office) AS office_code
    FROM \`${src}\`.g_users
    WHERE office IS NOT NULL AND TRIM(office) <> ''
      AND (hrStatus IS NULL OR hrStatus NOT REGEXP 'term|inactive')
      AND TRIM(office) NOT LIKE 'COR %'
      AND hierarchyRegion IS NOT NULL AND TRIM(hierarchyRegion) <> ''
    GROUP BY TRIM(office)
    ORDER BY TRIM(office)
  `);

  const toInsert = [];
  for (const r of rows) {
    const raw = String(r.office_code ?? '').trim();
    const code = normOfficeCode(raw);
    if (!code || byCode.has(code)) continue;
    if (raw.length > 50) continue;
    if (/^COR\s/i.test(raw)) continue;
    maxId += 1;
    byCode.add(code);
    toInsert.push([maxId, companyId, raw, raw, null]);
  }

  if (!toInsert.length) {
    return { added: 0, codes: [] };
  }

  const BATCH = 100;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const chunk = toInsert.slice(i, i + BATCH);
    const ph = chunk.map(() => '(?, ?, ?, ?, ?)').join(', ');
    await targetConn.query(
      `INSERT INTO \`${tgt}\`.ref_company_office
         (id_company_office, id_company, office_code, display_name, capacity)
       VALUES ${ph}`,
      chunk.flat(),
    );
  }

  return {
    added: toInsert.length,
    codes: toInsert.map((row) => row[2]),
  };
}

/**
 * Remove COR * clinic offices from ref_company_office (not marketing catalog).
 * Clears FKs that pointed at those rows, then deletes the catalog rows.
 * Safe / idempotent — used by copy-catalogs and scripts/purge-cor-offices.js.
 */
async function purgeCorOfficesFromCatalog(targetConn) {
  const tgt = config.target.database;

  const [corRows] = await targetConn.query(
    `SELECT id_company_office, office_code
     FROM \`${tgt}\`.ref_company_office
     WHERE office_code LIKE 'COR %'`,
  );
  if (!corRows.length) {
    return { removed: 0, codes: [], cleared: {} };
  }

  const ids = corRows.map((r) => Number(r.id_company_office));
  const ph = ids.map(() => '?').join(', ');
  const cleared = {};

  const clearFk = async (table, column) => {
    try {
      const [result] = await targetConn.query(
        `UPDATE \`${tgt}\`.\`${table}\`
         SET \`${column}\` = NULL
         WHERE \`${column}\` IN (${ph})`,
        ids,
      );
      cleared[`${table}.${column}`] = result.affectedRows || 0;
    } catch (err) {
      if (err && (err.errno === 1146 || err.code === 'ER_NO_SUCH_TABLE')) {
        cleared[`${table}.${column}`] = 'skipped (no table)';
        return;
      }
      throw err;
    }
  };

  await clearFk('app_user', 'id_company_office');
  await clearFk('hierarchy_membership', 'id_company_office');
  await clearFk('lead', 'id_company_office');
  await clearFk('lead_org_snapshot', 'id_company_office');
  await clearFk('user_access_grant', 'id_company_office');

  const [del] = await targetConn.query(
    `DELETE FROM \`${tgt}\`.ref_company_office WHERE id_company_office IN (${ph})`,
    ids,
  );

  return {
    removed: del.affectedRows || corRows.length,
    codes: corRows.map((r) => r.office_code),
    cleared,
  };
}

/**
 * Re-link app_user.id_company_office from g_users.office → ref_company_office.
 * Needed after append:missing-offices so new codes (1800, CFL-LBA, …) get users.
 * Idempotent. Does not truncate. Uses temp table + JOIN (fast).
 */
async function backfillAppUserOfficeFromGUsers(sourceConn, targetConn) {
  const src = config.source.database;
  const tgt = config.target.database;
  const { resolveCompanyOfficeId } = await loadCompanyOfficeMap(targetConn);

  const [rows] = await sourceConn.query(`
    SELECT TRIM(email) AS email, TRIM(office) AS office
    FROM \`${src}\`.g_users
    WHERE email IS NOT NULL AND TRIM(email) <> ''
      AND office IS NOT NULL AND TRIM(office) <> ''
  `);

  const byEmail = new Map();
  for (const r of rows) {
    const email = String(r.email || '')
      .trim()
      .toLowerCase();
    if (!email) continue;
    const officeId = resolveCompanyOfficeId(r.office);
    if (officeId == null) continue;
    byEmail.set(email, officeId);
  }

  const entries = [...byEmail.entries()];
  if (!entries.length) {
    return { updated: 0, mappedEmails: 0 };
  }

  await targetConn.query(`
    CREATE TEMPORARY TABLE tmp_app_user_office_map (
      email varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      id_company_office int NOT NULL,
      PRIMARY KEY (email)
    ) ENGINE=Memory
  `);

  const BATCH = 500;
  for (let i = 0; i < entries.length; i += BATCH) {
    const chunk = entries.slice(i, i + BATCH);
    const ph = chunk.map(() => '(?, ?)').join(', ');
    await targetConn.query(
      `INSERT INTO tmp_app_user_office_map (email, id_company_office) VALUES ${ph}`,
      chunk.flat(),
    );
  }

  const [result] = await targetConn.query(`
    UPDATE \`${tgt}\`.app_user au
    INNER JOIN tmp_app_user_office_map m
      ON LOWER(TRIM(au.email)) COLLATE utf8mb4_unicode_ci = m.email
    SET au.id_company_office = m.id_company_office
    WHERE au.id_company_office IS NULL
       OR au.id_company_office <> m.id_company_office
  `);

  await targetConn.query('DROP TEMPORARY TABLE IF EXISTS tmp_app_user_office_map');

  return { updated: result.affectedRows || 0, mappedEmails: byEmail.size };
}

module.exports = {
  loadCompanyOfficeMap,
  normOfficeCode,
  appendMissingOfficesFromGUsers,
  purgeCorOfficesFromCatalog,
  backfillAppUserOfficeFromGUsers,
};
