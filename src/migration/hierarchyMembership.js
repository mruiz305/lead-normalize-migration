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

function hasGlideHierarchy(gu) {
  return Boolean(
    normEmail(gu.hierarchyDirectorate) ||
      normEmail(gu.hierarchyRegion) ||
      normEmail(gu.hierarchyOffice) ||
      normEmail(gu.hierarchyPod) ||
      normEmail(gu.hierarchyTeam) ||
      normEmail(gu.hierarchyDuo)
  );
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

function membershipKey(userId, level, office, leader, isLeader) {
  return `${userId}:${level}:${office ?? ''}:${leader ?? ''}:${isLeader ? 1 : 0}`;
}

async function loadGlideMemberships(targetConn, tgtDb, userIds) {
  const byKey = new Map();
  if (!userIds.length) return byKey;
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const chunk = userIds.slice(i, i + BATCH_SIZE);
    const [rows] = await targetConn.query(
      `SELECT membership_id, user_id, id_hierarchy_level, id_company_office, leader_user_id,
              is_leader, is_primary, is_active
       FROM \`${tgtDb}\`.hierarchy_membership
       WHERE origin = 'GLIDE' AND user_id IN (${chunk.map(() => '?').join(',')})`,
      chunk
    );
    for (const r of rows) {
      byKey.set(
        membershipKey(
          Number(r.user_id),
          Number(r.id_hierarchy_level),
          r.id_company_office,
          r.leader_user_id,
          Number(r.is_leader)
        ),
        r
      );
    }
  }
  return byKey;
}

async function applyMembershipFlagUpdates(targetConn, tgtDb, toUpdate) {
  if (!toUpdate.length) return 0;
  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const chunk = toUpdate.slice(i, i + BATCH_SIZE);
    const ids = chunk.map(([id]) => id);
    const whenPrimary = chunk.map(() => 'WHEN ? THEN ?').join(' ');
    const whenActive = chunk.map(() => 'WHEN ? THEN ?').join(' ');
    const params = [];
    for (const [id, isPrimary] of chunk) params.push(id, isPrimary);
    for (const [id, , isActive] of chunk) params.push(id, isActive);
    for (const [id, , isActive] of chunk) params.push(id, isActive);
    params.push(...ids);
    await targetConn.query(
      `UPDATE \`${tgtDb}\`.hierarchy_membership
       SET is_primary = CASE membership_id ${whenPrimary} END,
           is_active = CASE membership_id ${whenActive} END,
           origin = 'GLIDE',
           end_date = IF(CASE membership_id ${whenActive} END = 1, NULL, COALESCE(end_date, CURDATE()))
       WHERE membership_id IN (${ids.map(() => '?').join(',')})`,
      params
    );
  }
  return toUpdate.length;
}

async function upsertMemberships(targetConn, tgtDb, pending) {
  if (!pending.length) return { inserted: 0, updated: 0, unchanged: 0, staleDeactivated: 0, portalClashes: 0 };

  const rebuiltIds = [...new Set(pending.map((p) => p[0]))];
  const existing = await loadGlideMemberships(targetConn, tgtDb, rebuiltIds);
  const keepIds = new Set();
  const toUpdate = [];
  const toInsert = [];
  const levelsByUser = new Map();
  let unchanged = 0;

  for (const row of pending) {
    const [userId, level, office, leader, isLeader, isPrimary, isActive] = row;
    const key = membershipKey(userId, level, office, leader, isLeader);
    const ex = existing.get(key);
    if (!levelsByUser.has(userId)) levelsByUser.set(userId, new Set());
    levelsByUser.get(userId).add(level);
    if (ex) {
      keepIds.add(Number(ex.membership_id));
      if (Number(ex.is_primary) === Number(isPrimary) && Number(ex.is_active) === Number(isActive)) {
        unchanged += 1;
      } else {
        toUpdate.push([Number(ex.membership_id), isPrimary, isActive]);
      }
    } else {
      toInsert.push(row);
    }
  }

  await applyMembershipFlagUpdates(targetConn, tgtDb, toUpdate);

  let inserted = 0;
  if (toInsert.length) {
    const head = `
      INSERT INTO \`${tgtDb}\`.hierarchy_membership
        (user_id, id_hierarchy_level, id_company_office, leader_user_id, is_leader, is_primary, is_active, origin)
      VALUES
    `;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const chunk = toInsert.slice(i, i + BATCH_SIZE);
      const [result] = await targetConn.query(
        `${head} ${chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, 'GLIDE')").join(', ')}`,
        chunk.flat()
      );
      inserted += result.affectedRows;
    }
  }

  const staleIds = [...existing.values()]
    .map((r) => Number(r.membership_id))
    .filter((id) => !keepIds.has(id));
  const staleDeactivated = await deactivateMemberships(targetConn, tgtDb, staleIds);

  // Mismo nivel: Glide manda, el PORTAL se apaga (no se borra).
  const [portalRows] = await targetConn.query(
    `SELECT membership_id, user_id, id_hierarchy_level
     FROM \`${tgtDb}\`.hierarchy_membership
     WHERE origin = 'PORTAL' AND is_active = 1`
  );
  const portalIds = [];
  for (const r of portalRows) {
    const levels = levelsByUser.get(Number(r.user_id));
    if (levels && levels.has(Number(r.id_hierarchy_level))) {
      portalIds.push(Number(r.membership_id));
    }
  }
  const portalClashes = await deactivateMemberships(targetConn, tgtDb, portalIds);

  return { inserted, updated: toUpdate.length, unchanged, staleDeactivated, portalClashes };
}

async function deactivateMemberships(targetConn, tgtDb, ids) {
  if (!ids.length) return 0;
  let n = 0;
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    const [r] = await targetConn.query(
      `UPDATE \`${tgtDb}\`.hierarchy_membership
       SET is_active = 0, end_date = COALESCE(end_date, CURDATE())
       WHERE membership_id IN (${chunk.map(() => '?').join(',')}) AND is_active = 1`,
      chunk
    );
    n += Number(r.affectedRows || 0);
  }
  return n;
}

async function pruneGlideUsersGone(targetConn, tgtDb, knownAppIds) {
  const [rows] = await targetConn.query(
    `SELECT membership_id, user_id FROM \`${tgtDb}\`.hierarchy_membership
     WHERE origin = 'GLIDE' AND is_active = 1`
  );
  const gone = rows
    .filter((r) => !knownAppIds.has(Number(r.user_id)))
    .map((r) => Number(r.membership_id));
  return deactivateMemberships(targetConn, tgtDb, gone);
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

  // Include inactive users: Glide still points hierarchy* emails at termed
  // managers (e.g. 1800 → jvluque). Restricting to is_active=1 dropped TEAM/POD
  // and left OFFICE without leader_user_id, so the portal showed empty hierarchy.
  const [appUsers] = await targetConn.query(
    `SELECT id_user, email, legacy_row_id, id_company_office, is_active
     FROM \`${tgtDb}\`.app_user`
  );
  const userById = new Map();
  const userByRowId = new Map();
  const userByEmail = new Map();
  for (const u of appUsers) {
    userById.set(Number(u.id_user), u);
    const rid = u.legacy_row_id ? String(u.legacy_row_id).trim() : '';
    if (rid) userByRowId.set(rid, u);
    const em = normEmail(u.email);
    if (!em) continue;
    const prev = userByEmail.get(em);
    if (!prev || (Number(prev.is_active) !== 1 && Number(u.is_active) === 1)) {
      userByEmail.set(em, u);
    }
  }

  const gUsers = await loadGUsers(sourceConn);

  const pending = [];
  const seen = new Set();
  const knownAppIds = new Set();

  function queue(userId, level, idCompanyOffice, leaderUserId, isLeader, isPrimary = 0, isActive = 1) {
    if (!userId || !level) return;
    const leaderFlag = isLeader ? 1 : 0;
    const activeFlag = isActive ? 1 : 0;
    // At most one primary member row per user+level.
    if (!leaderFlag && isPrimary) {
      const primaryKey = `primary:${userId}:${level}`;
      if (seen.has(primaryKey)) return;
      seen.add(primaryKey);
    }
    const key = `${userId}:${level}:${idCompanyOffice ?? ''}:${leaderUserId ?? ''}:${leaderFlag}`;
    if (seen.has(key)) return;
    seen.add(key);
    pending.push([userId, level, idCompanyOffice, leaderUserId, leaderFlag, isPrimary ? 1 : 0, activeFlag]);
  }

  let memberCount = 0;
  for (const gu of gUsers) {
    const rowId = gu.rowId ? String(gu.rowId).trim() : '';
    // rowId is the sync key; g_users.id may be remapped in app_user.
    const appUser =
      (rowId ? userByRowId.get(rowId) : null) || userById.get(Number(gu.id)) || null;
    if (!appUser) continue;
    knownAppIds.add(Number(appUser.id_user));
    // Sin emails de jefe en g_users todavía: no encolar (ni borrar PORTAL).
    if (!hasGlideHierarchy(gu)) continue;

    // Termed: keep last Glide snapshot (is_active=0) so UM still shows
    // team/pod/office at inactivation. Live org stays on is_active=1.
    const memberActive = isActiveHr(gu.hrStatus) ? 1 : 0;

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
      queue(appUser.id_user, LEVEL.OFFICE, idOffice, leaderOfficeId, false, 1, memberActive);
      memberCount += 1;
    } else if (leaderOfficeId && leaderOfficeId !== appUser.id_user) {
      queue(appUser.id_user, LEVEL.OFFICE, null, leaderOfficeId, false, 1, memberActive);
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
      queue(appUser.id_user, level, null, leaderId, false, 1, memberActive);
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

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let staleDeactivated = 0;
  let portalClashes = 0;
  let goneDeactivated = 0;
  await targetConn.beginTransaction();
  try {
    const stats = await upsertMemberships(targetConn, tgtDb, pending);
    inserted = stats.inserted;
    updated = stats.updated;
    unchanged = stats.unchanged;
    staleDeactivated = stats.staleDeactivated;
    portalClashes = stats.portalClashes;
    if (gUsers.length) {
      goneDeactivated = await pruneGlideUsersGone(targetConn, tgtDb, knownAppIds);
    }
    await targetConn.commit();
  } catch (err) {
    await targetConn.rollback();
    throw err;
  }
  console.log(
    `  ✓ hierarchy_membership: ${inserted} new, ${updated} upd, ${unchanged} igual` +
      ` (${memberCount} office members, ${leaderCount} leaders)` +
      (staleDeactivated ? `, ${staleDeactivated} glide viejas inactivas` : '') +
      (portalClashes ? `, ${portalClashes} portal inactivas (mismo nivel)` : '') +
      (goneDeactivated ? `, ${goneDeactivated} inactivas (usuario ya no está en g_users)` : '')
  );
  return {
    inserted,
    updated,
    unchanged,
    members: memberCount,
    leaders: leaderCount,
    staleDeactivated,
    portalClashes,
    goneDeactivated,
    skipped: false,
  };
}

module.exports = { populateHierarchyMembership };
