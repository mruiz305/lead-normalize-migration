const config = require('../config');

const TENANT_ID = 1;
const BATCH = 500;

const T = {
  users: 'users',
  userExternalLinks: 'user_external_links',
  roles: 'roles',
  permissions: 'permissions',
  rolePermissions: 'role_permissions',
  userRoles: 'user_roles',
  userResourceAccess: 'user_resource_access',
  applications: 'applications',
};

function normEmail(v) {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  return s === '' ? null : s;
}

async function bulkInsert(secConn, sqlHead, rows, rowPlaceholder) {
  if (!rows.length) return 0;
  let n = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const [result] = await secConn.query(
      `${sqlHead} ${chunk.map(() => rowPlaceholder).join(', ')}`,
      chunk.flat()
    );
    n += result.affectedRows;
  }
  return n;
}

async function truncateSyncData(secConn, secDb) {
  await secConn.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of [
    T.userResourceAccess,
    T.userRoles,
    T.rolePermissions,
    T.permissions,
    T.roles,
    T.userExternalLinks,
    T.users,
  ]) {
    await secConn.query(`TRUNCATE TABLE \`${secDb}\`.\`${t}\``);
  }
  await secConn.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function loadPersonaByEmail(secConn, secDb) {
  const [rows] = await secConn.query(
    `SELECT id, email FROM \`${secDb}\`.${T.users} WHERE tenant_id = ?`,
    [TENANT_ID]
  );
  const map = new Map();
  for (const r of rows) map.set(normEmail(r.email), r.id);
  return map;
}

async function getSistemaId(secConn, secDb, systemCode) {
  const [[row]] = await secConn.query(
    `SELECT id FROM \`${secDb}\`.${T.applications} WHERE tenant_id = ? AND system_code = ? LIMIT 1`,
    [TENANT_ID, systemCode]
  );
  return row?.id ?? null;
}

/** Portal identity_service_dev — solo lectura */
async function syncPortal(identityConn, secConn) {
  const idDb = config.identity.database;
  const secDb = config.security.database;
  const now = new Date();
  const idSistemaPortal = await getSistemaId(secConn, secDb, 'PORTAL_ABOGADOS');
  if (!idSistemaPortal) throw new Error('Falta applications PORTAL_ABOGADOS en SECURITY_TNFG');

  const [roles] = await identityConn.query(
    `SELECT id, name FROM \`${idDb}\`.roles ORDER BY id`
  );
  await bulkInsert(
    secConn,
    `INSERT INTO \`${secDb}\`.${T.roles} (tenant_id, application_id, role_code, display_name, portal_role_id, synced_at) VALUES`,
    roles.map((r) => [TENANT_ID, idSistemaPortal, r.name, r.name, r.id, now]),
    '(?, ?, ?, ?, ?, ?)'
  );
  const [rolRows] = await secConn.query(
    `SELECT id, portal_role_id FROM \`${secDb}\`.${T.roles} WHERE portal_role_id IS NOT NULL`
  );
  const roleIdMap = new Map(rolRows.map((r) => [Number(r.portal_role_id), r.id]));

  const [perms] = await identityConn.query(
    `SELECT id, name FROM \`${idDb}\`.permissions ORDER BY id`
  );
  await bulkInsert(
    secConn,
    `INSERT INTO \`${secDb}\`.${T.permissions} (tenant_id, application_id, permission_code, display_name, portal_permission_id, synced_at) VALUES`,
    perms.map((p) => [TENANT_ID, idSistemaPortal, p.name, p.name, p.id, now]),
    '(?, ?, ?, ?, ?, ?)'
  );
  const [permRows] = await secConn.query(
    `SELECT id, portal_permission_id FROM \`${secDb}\`.${T.permissions} WHERE portal_permission_id IS NOT NULL`
  );
  const permIdMap = new Map(permRows.map((p) => [Number(p.portal_permission_id), p.id]));

  const [rps] = await identityConn.query(
    `SELECT id, role_id, permission_id FROM \`${idDb}\`.role_permissions`
  );
  const rpRows = [];
  for (const rp of rps) {
    const idRol = roleIdMap.get(Number(rp.role_id));
    const idPerm = permIdMap.get(Number(rp.permission_id));
    if (idRol && idPerm) rpRows.push([idRol, idPerm, rp.id, now]);
  }
  const rpCount = await bulkInsert(
    secConn,
    `INSERT IGNORE INTO \`${secDb}\`.${T.rolePermissions} (role_id, permission_id, portal_role_permission_id, synced_at) VALUES`,
    rpRows,
    '(?, ?, ?, ?)'
  );

  const [users] = await identityConn.query(
    `SELECT id, email, is_active FROM \`${idDb}\`.users WHERE email IS NOT NULL AND TRIM(email) <> ''`
  );
  await bulkInsert(
    secConn,
    `INSERT INTO \`${secDb}\`.${T.users} (tenant_id, email, display_name, person_kind, is_active) VALUES`,
    users.map((u) => [TENANT_ID, normEmail(u.email), null, 'SOCIO_EXTERNO', u.is_active ? 1 : 0]),
    '(?, ?, ?, ?, ?)'
  );
  const personaByEmail = await loadPersonaByEmail(secConn, secDb);
  const personaByPortalUser = new Map();
  const origenRows = [];
  for (const u of users) {
    const idPersona = personaByEmail.get(normEmail(u.email));
    if (!idPersona) continue;
    personaByPortalUser.set(Number(u.id), idPersona);
    origenRows.push([idPersona, 'PORTAL_IDENTITY', String(u.id)]);
  }
  await bulkInsert(
    secConn,
    `INSERT INTO \`${secDb}\`.${T.userExternalLinks} (user_id, source_system, external_id) VALUES`,
    origenRows,
    '(?, ?, ?)'
  );

  const [userRoles] = await identityConn.query(
    `SELECT id, user_id, role_id FROM \`${idDb}\`.user_roles`
  );
  const prRows = [];
  for (const ur of userRoles) {
    const idPersona = personaByPortalUser.get(Number(ur.user_id));
    const idRol = roleIdMap.get(Number(ur.role_id));
    if (idPersona && idRol) prRows.push([idPersona, idRol, ur.id, now]);
  }
  const prCount = await bulkInsert(
    secConn,
    `INSERT INTO \`${secDb}\`.${T.userRoles} (user_id, role_id, portal_user_role_id, synced_at) VALUES`,
    prRows,
    '(?, ?, ?, ?)'
  );

  const [access] = await identityConn.query(
    `SELECT id, user_id, resource_type, resource_external_id FROM \`${idDb}\`.user_resource_access`
  );
  const resourceMap = { attorney: 'ABOGADO', txlocation: 'CLINICA_TX' };
  const accRows = [];
  for (const a of access) {
    const idPersona = personaByPortalUser.get(Number(a.user_id));
    const rt = resourceMap[a.resource_type];
    if (idPersona && rt) {
      accRows.push([idPersona, idSistemaPortal, rt, a.resource_external_id, 'VER', a.id, now]);
    }
  }
  const accCount = await bulkInsert(
    secConn,
    `INSERT INTO \`${secDb}\`.${T.userResourceAccess}
      (user_id, application_id, resource_type, resource_external_id, access_level, portal_resource_access_id, synced_at) VALUES`,
    accRows,
    '(?, ?, ?, ?, ?, ?, ?)'
  );

  return {
    roles: roles.length,
    permissions: perms.length,
    rol_permiso: rpCount,
    personas: personaByPortalUser.size,
    persona_rol: prRows.length,
    accesos: accRows.length,
  };
}

/** Staff intake — TNFG_INTAKE.app_user (modelo migrado, NO g_users) */
async function syncIntake(targetConn, secConn) {
  const tgtDb = config.target.database;
  const secDb = config.security.database;

  const [users] = await targetConn.query(`
    SELECT id_user, email, display_name, is_active
    FROM \`${tgtDb}\`.app_user
    WHERE email IS NOT NULL AND TRIM(email) <> ''
    ORDER BY id_user
  `);

  const personaByEmailBefore = await loadPersonaByEmail(secConn, secDb);

  for (let i = 0; i < users.length; i += BATCH) {
    const chunk = users.slice(i, i + BATCH);
    const ph = chunk.map(() => '(?, ?, ?, ?, ?)').join(', ');
    const params = chunk.flatMap((u) => [
      TENANT_ID,
      normEmail(u.email),
      u.display_name || null,
      'STAFF_INTERNO',
      u.is_active ? 1 : 0,
    ]);
    await secConn.query(
      `INSERT INTO \`${secDb}\`.${T.users} (tenant_id, email, display_name, person_kind, is_active) VALUES ${ph}
       ON DUPLICATE KEY UPDATE
         display_name = COALESCE(VALUES(display_name), display_name),
         person_kind = 'STAFF_INTERNO',
         is_active = GREATEST(is_active, VALUES(is_active))`,
      params
    );
  }

  const personaByEmail = await loadPersonaByEmail(secConn, secDb);
  let merged = 0;
  for (const u of users) {
    const em = normEmail(u.email);
    if (em && personaByEmailBefore.has(em)) merged += 1;
  }

  const origenRows = [];
  const origenSeen = new Set();
  for (const u of users) {
    const em = normEmail(u.email);
    if (!em) continue;
    const idPersona = personaByEmail.get(em);
    if (!idPersona) continue;
    const key = `${idPersona}|INTAKE_APP_USER|${u.id_user}`;
    if (origenSeen.has(key)) continue;
    origenSeen.add(key);
    origenRows.push([idPersona, 'INTAKE_APP_USER', String(u.id_user)]);
  }
  await bulkInsert(
    secConn,
    `INSERT IGNORE INTO \`${secDb}\`.${T.userExternalLinks} (user_id, source_system, external_id) VALUES`,
    origenRows,
    '(?, ?, ?)'
  );

  return {
    app_users: users.length,
    personas_linked: origenRows.length,
    email_already_in_portal: merged,
  };
}

async function runSecuritySync({ truncate = false } = {}) {
  const { withSecurity, withIdentity, withTarget, closeAll } = require('../db');

  const stats = {};
  await withSecurity(async (secConn) => {
    const secDb = config.security.database;
    if (truncate) await truncateSyncData(secConn, secDb);

    await withIdentity(async (identityConn) => {
      stats.portal = await syncPortal(identityConn, secConn);
    });

    await withTarget(async (targetConn) => {
      stats.intake = await syncIntake(targetConn, secConn);
    });

    stats.totals = {};
    for (const [key, table] of Object.entries(T)) {
      if (table === T.applications) continue;
      const [[{ n }]] = await secConn.query(`SELECT COUNT(*) AS n FROM \`${secDb}\`.\`${table}\``);
      stats.totals[key] = n;
    }
  });

  await closeAll();
  return stats;
}

module.exports = {
  syncPortal,
  syncIntake,
  runSecuritySync,
};
