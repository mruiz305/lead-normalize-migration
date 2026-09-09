const config = require('../config');
const { LEVEL } = require('./hierarchyLevel');
const { normOfficeCode } = require('./officeCatalog');

const BATCH_SIZE = 200;

const HIERARCHY_FIELDS = [
  { level: LEVEL.DIRECTORATE, field: 'hierarchyDirectorate' },
  { level: LEVEL.REGION, field: 'hierarchyRegion' },
  { level: LEVEL.OFFICE, field: 'hierarchyOffice' },
  { level: LEVEL.POD, field: 'hierarchyPod' },
  { level: LEVEL.TEAM, field: 'hierarchyTeam' },
  { level: LEVEL.DUO, field: 'hierarchyDuo' },
];

function normEmail(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s.toLowerCase();
}

function isActiveHr(hrStatus) {
  if (!hrStatus) return true;
  return !/term|inactive/i.test(String(hrStatus));
}

async function loadGUsers(sourceConn) {
  const srcDb = config.source.database;
  const [rows] = await sourceConn.query(`
    SELECT
      id,
      rowId,
      email,
      office,
      hierarchyDirectorate,
      hierarchyRegion,
      hierarchyOffice,
      hierarchyPod,
      hierarchyTeam,
      hierarchyDuo,
      hrStatus
    FROM \`${srcDb}\`.g_users
    WHERE rowId IS NOT NULL AND TRIM(rowId) <> ''
  `);
  return rows;
}

async function loadCompanyOfficeMap(targetConn) {
  const db = config.target.database;
  const [rows] = await targetConn.query(
    `SELECT id_company_office, office_code FROM \`${db}\`.ref_company_office WHERE is_active = 1`
  );
  const byCode = new Map();
  for (const r of rows) {
    const code = normOfficeCode(r.office_code);
    if (code) byCode.set(code, r.id_company_office);
  }
  return byCode;
}

async function flushMemberships(targetConn, tgtDb, batch) {
  if (!batch.length) return 0;
  const head = `
    INSERT INTO \`${tgtDb}\`.hierarchy_membership
      (user_id, id_hierarchy_level, id_company_office, leader_user_id, is_leader, is_primary, is_active)
    VALUES
  `;
  const placeholder = '(?, ?, ?, ?, ?, ?, 1)';
  let inserted = 0;
  for (let i = 0; i < batch.length; i += BATCH_SIZE) {
    const chunk = batch.slice(i, i + BATCH_SIZE);
    const params = chunk.flat();
    const [result] = await targetConn.query(
      `${head} ${chunk.map(() => placeholder).join(', ')}`,
      params
    );
    inserted += result.affectedRows;
  }
  return inserted;
}

/**
 * hierarchy_membership desde g_users:
 * - OFFICE: id_company_office (catálogo) + leader opcional
 * - POD/TEAM/DUO/…: leader_user_id (sin catálogo de nombres)
 * - is_leader: 1 = jefe en ese nivel, 0 = miembro / reporta
 */
async function populateHierarchyMembership(sourceConn, targetConn, { truncate = true } = {}) {
  const tgtDb = config.target.database;

  const [[{ userCount }]] = await targetConn.query(
    `SELECT COUNT(*) AS userCount FROM \`${tgtDb}\`.app_user`
  );
  if (Number(userCount) === 0) {
    console.log('  ⚠ hierarchy_membership: app_user vacío — omitido');
    return { inserted: 0, skipped: true };
  }

  const officeByCode = await loadCompanyOfficeMap(targetConn);

  const [appUsers] = await targetConn.query(
    `SELECT id_user, email, legacy_row_id, id_company_office
     FROM \`${tgtDb}\`.app_user WHERE is_active = 1`
  );
  const userById = new Map();
  const userByRowId = new Map();
  const userByEmail = new Map();
  for (const u of appUsers) {
    userById.set(Number(u.id_user), u);
    const rid = u.legacy_row_id ? String(u.legacy_row_id).trim() : '';
    if (rid) userByRowId.set(rid, u);
    const em = normEmail(u.email);
    if (em && !userByEmail.has(em)) userByEmail.set(em, u);
  }

  const gUsers = await loadGUsers(sourceConn);

  if (truncate) {
    await targetConn.query('SET FOREIGN_KEY_CHECKS = 0');
    await targetConn.query(`TRUNCATE TABLE \`${tgtDb}\`.hierarchy_membership`);
    await targetConn.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  const pending = [];
  const seen = new Set();

  function queue(userId, level, idCompanyOffice, leaderUserId, isLeader, isPrimary = 0) {
    if (!userId || !level) return;
    const leaderFlag = isLeader ? 1 : 0;
    // At most one primary member row per user+level.
    if (!leaderFlag && isPrimary) {
      const primaryKey = `primary:${userId}:${level}`;
      if (seen.has(primaryKey)) return;
      seen.add(primaryKey);
    }
    const key = `${userId}:${level}:${idCompanyOffice ?? ''}:${leaderUserId ?? ''}:${leaderFlag}`;
    if (seen.has(key)) return;
    seen.add(key);
    pending.push([userId, level, idCompanyOffice, leaderUserId, leaderFlag, isPrimary ? 1 : 0]);
  }

  let memberCount = 0;
  for (const gu of gUsers) {
    if (!isActiveHr(gu.hrStatus)) continue;
    const rowId = gu.rowId ? String(gu.rowId).trim() : '';
    const appUser = userById.get(Number(gu.id)) || (rowId ? userByRowId.get(rowId) : null);
    if (!appUser) continue;

    const idOffice =
      appUser.id_company_office ??
      officeByCode.get(normOfficeCode(gu.office)) ??
      null;

    const leaderOfficeId = userByEmail.get(normEmail(gu.hierarchyOffice))?.id_user ?? null;
    const leaderPodId = userByEmail.get(normEmail(gu.hierarchyPod))?.id_user ?? null;
    const leaderTeamId = userByEmail.get(normEmail(gu.hierarchyTeam))?.id_user ?? null;
    const leaderDuoId = userByEmail.get(normEmail(gu.hierarchyDuo))?.id_user ?? null;
    const leaderDirId = userByEmail.get(normEmail(gu.hierarchyDirectorate))?.id_user ?? null;
    const leaderRegId = userByEmail.get(normEmail(gu.hierarchyRegion))?.id_user ?? null;

    // One OFFICE member row only (primary). Do NOT also queue a null-office duplicate —
    // that made fetchSubmitterDetail LIMIT 1 nondeterministic and froze wrong org on create.
    if (idOffice) {
      queue(appUser.id_user, LEVEL.OFFICE, idOffice, leaderOfficeId, false, 1);
      memberCount += 1;
    } else if (leaderOfficeId && leaderOfficeId !== appUser.id_user) {
      queue(appUser.id_user, LEVEL.OFFICE, null, leaderOfficeId, false, 1);
      memberCount += 1;
    }

    // Other levels: single primary member row pointing at hierarchy* leader from g_users.
    const leaderByLevel = [
      [LEVEL.DIRECTORATE, leaderDirId],
      [LEVEL.REGION, leaderRegId],
      [LEVEL.POD, leaderPodId],
      [LEVEL.TEAM, leaderTeamId],
      [LEVEL.DUO, leaderDuoId],
    ];
    for (const [level, leaderId] of leaderByLevel) {
      if (!leaderId || leaderId === appUser.id_user) continue;
      queue(appUser.id_user, level, null, leaderId, false, 1);
    }
  }

  let leaderCount = 0;
  for (const { level, field } of HIERARCHY_FIELDS) {
    const leaderToReports = new Map();

    for (const gu of gUsers) {
      if (!isActiveHr(gu.hrStatus)) continue;
      const leaderEmail = normEmail(gu[field]);
      const reportEmail = normEmail(gu.email);
      if (!leaderEmail || !reportEmail || leaderEmail === reportEmail) continue;
      if (!leaderToReports.has(leaderEmail)) leaderToReports.set(leaderEmail, []);
      leaderToReports.get(leaderEmail).push(gu);
    }

    for (const [leaderEmail, reports] of leaderToReports) {
      const leaderApp = userByEmail.get(leaderEmail);
      if (!leaderApp) continue;

      if (level === LEVEL.OFFICE) {
        const officeIds = new Set();
        for (const gu of reports) {
          const oid = officeByCode.get(normOfficeCode(gu.office)) ?? null;
          if (oid) officeIds.add(oid);
        }
        for (const oid of officeIds) {
          queue(leaderApp.id_user, level, oid, null, true, 0);
          leaderCount += 1;
        }
      } else {
        queue(leaderApp.id_user, level, null, null, true, 0);
        leaderCount += 1;
      }
    }
  }

  const inserted = await flushMemberships(targetConn, tgtDb, pending);
  console.log(
    `  ✓ hierarchy_membership: ${inserted} filas (${memberCount} office members, ${leaderCount} leaders)`
  );
  return { inserted, members: memberCount, leaders: leaderCount, skipped: false };
}

module.exports = { populateHierarchyMembership };
