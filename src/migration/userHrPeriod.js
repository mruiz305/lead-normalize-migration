const config = require('../config');

const TABLE = 'user_hr_period';

function normEmail(v) {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  return s === '' ? null : s;
}

function isActiveHr(hrStatus) {
  if (!hrStatus) return true;
  return !/term|inactive/i.test(String(hrStatus));
}

/** Fila canónica para app_user: Active más reciente por id, si no la más reciente. */
function pickCanonicalRow(rows) {
  if (!rows.length) return null;
  const active = rows.filter((r) => String(r.hrStatus || '').toLowerCase() === 'active');
  const pool = active.length ? active : rows;
  return pool.sort((a, b) => Number(b.id) - Number(a.id))[0];
}

function stintSortKey(row) {
  const hired = row.hrHired ? new Date(row.hrHired).getTime() : null;
  if (hired != null && !Number.isNaN(hired)) return hired;
  return Number(row.id) * 1e6;
}

/** Ordena pasadas laborales cronológicamente y numera stint 1..n. */
function buildStints(rows) {
  const sorted = [...rows].sort((a, b) => stintSortKey(a) - stintSortKey(b));
  return sorted.map((row, idx) => ({
    row,
    stint_order: idx + 1,
  }));
}

function isOngoingStint(row) {
  if (row.hrTermed) return false;
  return isActiveHr(row.hrStatus);
}

/** Pasada cerrada o única baja → user_hr_period. Vigente activo → solo app_user. */
function shouldInsertPeriod(row, isCurrent) {
  if (isCurrent && isOngoingStint(row)) return false;
  return true;
}

function rehireStats(stintCount) {
  const n = Number(stintCount) || 0;
  return {
    employment_stints: n,
    times_left_and_returned: Math.max(0, n - 1),
  };
}

const SOURCE_PERIOD_COLUMNS = `
  id,
  email,
  hrStatus,
  hrHired,
  hrTermed
`;

async function loadSourcePeriods(sourceConn) {
  const srcDb = config.source.database;
  const [rows] = await sourceConn.query(`
    SELECT ${SOURCE_PERIOD_COLUMNS}
    FROM \`${srcDb}\`.g_users
    WHERE email IS NOT NULL AND TRIM(email) <> ''
    ORDER BY id
  `);
  return rows;
}

function groupByEmail(rows) {
  const byEmail = new Map();
  for (const r of rows) {
    const email = normEmail(r.email);
    if (!email) continue;
    if (!byEmail.has(email)) byEmail.set(email, []);
    byEmail.get(email).push(r);
  }
  return byEmail;
}

async function flushPeriods(targetConn, tgtDb, batch) {
  if (!batch.length) return 0;
  const head = `
    INSERT INTO \`${tgtDb}\`.${TABLE} (
      id_user, hr_status, hired_at, termed_at, stint_order, is_current_stint
    ) VALUES
  `;
  const ph = '(?, ?, ?, ?, ?, ?)';
  let inserted = 0;
  const BATCH = 200;
  for (let i = 0; i < batch.length; i += BATCH) {
    const chunk = batch.slice(i, i + BATCH);
    const [result] = await targetConn.query(
      `${head} ${chunk.map(() => ph).join(', ')}`,
      chunk.flat()
    );
    inserted += result.affectedRows;
  }
  return inserted;
}

/** Sincroniza pasadas HR desde origen (agrupa por email → app_user). */
async function syncUserHrPeriod(sourceConn, targetConn, { truncate = true } = {}) {
  const tgtDb = config.target.database;

  const [users] = await targetConn.query(
    `SELECT id_user, LOWER(TRIM(email)) AS email FROM \`${tgtDb}\`.app_user`
  );
  const userByEmail = new Map(users.map((u) => [u.email, u.id_user]));

  const sourceRows = await loadSourcePeriods(sourceConn);
  const byEmail = groupByEmail(sourceRows);

  if (truncate) {
    await targetConn.query('SET FOREIGN_KEY_CHECKS = 0');
    await targetConn.query(`TRUNCATE TABLE \`${tgtDb}\`.${TABLE}`);
    await targetConn.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  const pending = [];
  let skipped = 0;
  let multiStint = 0;

  for (const [email, emailRows] of byEmail) {
    const idUser = userByEmail.get(email);
    if (!idUser) {
      skipped += emailRows.length;
      continue;
    }
    if (emailRows.length > 1) multiStint += 1;

    const stints = buildStints(emailRows);
    const canonical = pickCanonicalRow(emailRows);
    for (const { row, stint_order } of stints) {
      const isCurrent = row.id === canonical?.id;
      if (!shouldInsertPeriod(row, isCurrent)) continue;
      pending.push([
        idUser,
        row.hrStatus ?? null,
        row.hrHired ?? null,
        row.hrTermed ?? null,
        stint_order,
        isCurrent ? 1 : 0,
      ]);
    }
  }

  const inserted = await flushPeriods(targetConn, tgtDb, pending);

  const [[{ withRehire }]] = await targetConn.query(`
    SELECT COUNT(*) AS withRehire FROM (
      SELECT u.id_user
      FROM \`${tgtDb}\`.app_user u
      LEFT JOIN \`${tgtDb}\`.${TABLE} p ON p.id_user = u.id_user
      GROUP BY u.id_user, u.is_active
      HAVING GREATEST(COUNT(p.period_id) + CASE WHEN u.is_active = 1 THEN 1 ELSE 0 END - 1, 0) > 0
    ) t
  `);

  console.log(
    `  ✓ ${TABLE}: ${inserted} pasadas cerradas` +
      ` (${multiStint} personas con >1 pasada en origen, ${withRehire} con reingreso)`
  );
  if (skipped) {
    console.log(`  ⚠ ${skipped} filas origen sin app_user (email no en destino)`);
  }

  return { inserted, multiStint, withRehire, skipped };
}

/** @deprecated use syncUserHrPeriod */
const syncUserEmploymentHistory = syncUserHrPeriod;

module.exports = {
  TABLE,
  normEmail,
  isActiveHr,
  isOngoingStint,
  shouldInsertPeriod,
  pickCanonicalRow,
  buildStints,
  rehireStats,
  syncUserHrPeriod,
  syncUserEmploymentHistory,
};
