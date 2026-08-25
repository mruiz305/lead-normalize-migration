/**
 * Asigna user_roles INTAKE según app_user.access_level legacy.
 * Solo STAFF_INTERNO con enlace INTAKE_APP_USER.
 */

const config = require('../config');

const TENANT_ID = 1;
const ROLE_BY_ACCESS = {
  ADMIN: 'intake_system_admin',
  DEFAULT: 'intake_submitter',
};

async function assignIntakeRoles({ dryRun = false } = {}) {
  const secDb = config.security.database;
  const tgtDb = config.target.database;
  const { withSecurity, withTarget, closeAll } = require('../db');

  let assigned = 0;
  let skipped = 0;

  await withSecurity(async (secConn) => {
    const [[{ idSistema }]] = await secConn.query(
      `SELECT id AS idSistema FROM \`${secDb}\`.applications
       WHERE tenant_id = ? AND system_code = 'INTAKE' LIMIT 1`,
      [TENANT_ID]
    );
    if (!idSistema) throw new Error('Falta applications INTAKE en SECURITY');

    const [roles] = await secConn.query(
      `SELECT id, role_code FROM \`${secDb}\`.roles
       WHERE tenant_id = ? AND application_id = ?`,
      [TENANT_ID, idSistema]
    );
    const roleByCode = new Map(roles.map((r) => [r.role_code, r.id]));

    await withTarget(async (tgtConn) => {
      const [users] = await tgtConn.query(
        `SELECT id_user, id_persona, access_level
         FROM \`${tgtDb}\`.app_user
         WHERE id_persona IS NOT NULL AND is_active = 1`
      );

      const rows = [];
      for (const u of users) {
        const code = u.access_level === 'ADMIN' ? ROLE_BY_ACCESS.ADMIN : ROLE_BY_ACCESS.DEFAULT;
        const idRol = roleByCode.get(code);
        if (!idRol || !u.id_persona) {
          skipped += 1;
          continue;
        }
        rows.push([u.id_persona, idRol]);
      }

      if (!dryRun && rows.length) {
        const BATCH = 500;
        for (let i = 0; i < rows.length; i += BATCH) {
          const chunk = rows.slice(i, i + BATCH);
          const ph = chunk.map(() => '(?, ?, 1)').join(', ');
          await secConn.query(
            `INSERT INTO \`${secDb}\`.user_roles (user_id, role_id, is_active) VALUES ${ph}
             ON DUPLICATE KEY UPDATE is_active = 1`,
            chunk.flatMap(([idPersona, idRol]) => [idPersona, idRol])
          );
        }
      }
      assigned = rows.length;
    });
  });

  await closeAll();
  return { assigned, skipped, dryRun };
}

module.exports = { assignIntakeRoles };
