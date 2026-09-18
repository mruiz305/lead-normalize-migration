/**
 * Altas g_users → SECURITY_TNFG.users (sin roles) y espejo de is_active.
 * Termed/Inactive en Glide apaga la persona para que no entre; si vuelven a
 * Active y ya existía, se reactiva la misma fila (no se crea otra).
 * Misma conexión que INTAKE (mismo host). No requiere variables nuevas en .env.
 */
const config = require('../config');

const TENANT_ID = 1;
const SOURCE_SYSTEM = 'REPRESENTATIVES_APP_USER';
const SECURITY_DB = (config.security && config.security.database) || 'SECURITY_TNFG';

function normEmail(v) {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  return s === '' ? null : s;
}

function displayNameOf(u) {
  const s = u.displayName != null ? String(u.displayName).trim() : '';
  return s || null;
}

function isActiveHr(hrStatus) {
  if (!hrStatus) return 1;
  return /term|inactive/i.test(String(hrStatus)) ? 0 : 1;
}

async function ensureExternalLink(conn, idPersona, idUser) {
  const [existing] = await conn.query(
    `SELECT id, external_id FROM \`${SECURITY_DB}\`.user_external_links
     WHERE user_id = ? AND source_system = ? LIMIT 1`,
    [idPersona, SOURCE_SYSTEM]
  );
  const externalId = String(idUser);
  if (!existing[0]) {
    await conn.query(
      `INSERT INTO \`${SECURITY_DB}\`.user_external_links (user_id, source_system, external_id)
       VALUES (?, ?, ?)`,
      [idPersona, SOURCE_SYSTEM, externalId]
    );
    return;
  }
  if (String(existing[0].external_id) !== externalId) {
    await conn.query(
      `UPDATE \`${SECURITY_DB}\`.user_external_links SET external_id = ? WHERE id = ?`,
      [externalId, existing[0].id]
    );
  }
}

async function setPersonaActive(conn, idPersona, isActive) {
  const flag = isActive ? 1 : 0;
  await conn.query(
    `UPDATE \`${SECURITY_DB}\`.users
     SET is_active = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND is_active <> ?`,
    [flag, idPersona, flag]
  );
}

/**
 * @param {import('mysql2/promise').PoolConnection} targetConn
 * @param {Array<{ idUser: number, email: string, displayName?: string, hrStatus?: string }>} inserts
 */
async function provisionSecurityForGlideInserts(targetConn, inserts = []) {
  if (!inserts.length) {
    return { skipped: false, created: 0, linked: 0, errors: 0 };
  }

  const tgtDb = config.target.database;
  let created = 0;
  let linked = 0;
  let errors = 0;

  for (const u of inserts) {
    const email = normEmail(u.email);
    const idUser = Number(u.idUser);
    if (!email || !idUser) continue;
    const active = isActiveHr(u.hrStatus);

    try {
      const [existing] = await targetConn.query(
        `SELECT id FROM \`${SECURITY_DB}\`.users WHERE LOWER(TRIM(email)) = ? LIMIT 1`,
        [email]
      );

      let idPersona;
      if (existing[0]) {
        idPersona = Number(existing[0].id);
        await setPersonaActive(targetConn, idPersona, active);
        linked += 1;
      } else {
        const [ins] = await targetConn.query(
          `INSERT INTO \`${SECURITY_DB}\`.users
             (tenant_id, email, display_name, person_kind, is_active)
           VALUES (?, ?, ?, 'STAFF_INTERNO', ?)`,
          [TENANT_ID, email, displayNameOf(u), active]
        );
        idPersona = Number(ins.insertId);
        if (!idPersona) throw new Error('users insert without id');
        created += 1;
      }

      await ensureExternalLink(targetConn, idPersona, idUser);
      await targetConn.query(
        `UPDATE \`${tgtDb}\`.app_user
         SET id_persona = ?
         WHERE id_user = ? AND (id_persona IS NULL OR id_persona = 0)`,
        [idPersona, idUser]
      );
    } catch (err) {
      errors += 1;
      console.warn(
        `  ⚠ security persona omitida email=${email} id_user=${idUser}: ${err.message || err}`
      );
    }
  }

  return { skipped: false, created, linked, errors };
}

/**
 * Espeja app_user.is_active → SECURITY.users.is_active para personas ya ligadas.
 * Termed: apaga y revoca sesiones. Active de nuevo: reactiva la misma persona.
 */
async function syncSecurityActiveFromAppUsers(targetConn) {
  const tgtDb = config.target.database;

  const [deactivated] = await targetConn.query(
    `UPDATE \`${SECURITY_DB}\`.users u
     INNER JOIN \`${tgtDb}\`.app_user a ON a.id_persona = u.id
     SET u.is_active = 0, u.updated_at = CURRENT_TIMESTAMP
     WHERE a.id_persona IS NOT NULL AND a.id_persona <> 0
       AND a.is_active = 0 AND u.is_active = 1`
  );

  const [reactivated] = await targetConn.query(
    `UPDATE \`${SECURITY_DB}\`.users u
     INNER JOIN \`${tgtDb}\`.app_user a ON a.id_persona = u.id
     SET u.is_active = 1, u.updated_at = CURRENT_TIMESTAMP
     WHERE a.id_persona IS NOT NULL AND a.id_persona <> 0
       AND a.is_active = 1 AND u.is_active = 0`
  );

  let sessionsRevoked = 0;
  const [sessTables] = await targetConn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sessions' LIMIT 1`,
    [SECURITY_DB]
  );
  if (sessTables.length) {
    const [revoked] = await targetConn.query(
      `UPDATE \`${SECURITY_DB}\`.sessions s
       INNER JOIN \`${tgtDb}\`.app_user a ON a.id_persona = s.user_id
       SET s.revoked_at = NOW()
       WHERE a.id_persona IS NOT NULL AND a.id_persona <> 0
         AND a.is_active = 0 AND s.revoked_at IS NULL`
    );
    sessionsRevoked = Number(revoked.affectedRows) || 0;
  }

  let credentialsOff = 0;
  const [credTables] = await targetConn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_credentials' LIMIT 1`,
    [SECURITY_DB]
  );
  if (credTables.length) {
    const [creds] = await targetConn.query(
      `UPDATE \`${SECURITY_DB}\`.user_credentials c
       INNER JOIN \`${tgtDb}\`.app_user a ON a.id_persona = c.user_id
       SET c.is_active = a.is_active, c.updated_at = CURRENT_TIMESTAMP
       WHERE a.id_persona IS NOT NULL AND a.id_persona <> 0
         AND c.is_active <> a.is_active`
    );
    credentialsOff = Number(creds.affectedRows) || 0;
  }

  return {
    skipped: false,
    deactivated: Number(deactivated.affectedRows) || 0,
    reactivated: Number(reactivated.affectedRows) || 0,
    sessionsRevoked,
    credentialsUpdated: credentialsOff,
  };
}

async function syncSecurityForGlideAppUsers(targetConn, inserts = []) {
  const provision = await provisionSecurityForGlideInserts(targetConn, inserts);
  const active = await syncSecurityActiveFromAppUsers(targetConn);
  return { ...provision, ...active };
}

module.exports = {
  provisionSecurityForGlideInserts,
  syncSecurityActiveFromAppUsers,
  syncSecurityForGlideAppUsers,
};
