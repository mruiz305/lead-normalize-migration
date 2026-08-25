#!/usr/bin/env node
/** Crea user_access_grant si falta y inserta ejemplos (Vladimir → team ajeno VIEW+export). */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

const LEVEL = { OFFICE: 3, TEAM: 5 };

async function tableExists(conn, db, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
    [db, table]
  );
  return rows.length > 0;
}

async function ensureTable(conn) {
  const db = config.target.database;
  if (await tableExists(conn, db, 'user_access_grant')) return;
  const sql = fs.readFileSync(
    path.join(config.sqlDir, 'patches', 'add_user_access_grant.sql'),
    'utf8'
  );
  await conn.query(sql);
  console.log('  ✓ user_access_grant creada');
}

async function findUser(conn, db, email) {
  const [rows] = await conn.query(
    `SELECT id_user, email, display_name FROM \`${db}\`.app_user
     WHERE LOWER(TRIM(email)) = ? LIMIT 1`,
    [email.toLowerCase()]
  );
  return rows[0] ?? null;
}

async function findOffice(conn, db, code) {
  const [rows] = await conn.query(
    `SELECT id_company_office, office_code FROM \`${db}\`.ref_company_office
     WHERE UPPER(TRIM(office_code)) = ? AND is_active = 1 LIMIT 1`,
    [code.toUpperCase()]
  );
  return rows[0] ?? null;
}

async function upsertGrant(conn, db, row) {
  const sql = `
    INSERT INTO \`${db}\`.user_access_grant (
      user_id, id_hierarchy_level, id_company_office, leader_user_id,
      access_level, can_export, valid_from, valid_to, reason, granted_by_user_id, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ON DUPLICATE KEY UPDATE
      access_level = VALUES(access_level),
      can_export = VALUES(can_export),
      valid_from = VALUES(valid_from),
      valid_to = VALUES(valid_to),
      reason = VALUES(reason),
      granted_by_user_id = VALUES(granted_by_user_id),
      is_active = 1
  `;
  const [result] = await conn.query(sql, row);
  return result.affectedRows;
}

/**
 * Ejemplos de negocio (permisos ADICIONALES, no scope propio):
 * 1) Vladimir: VIEW + export del team de Tony Press (no es su team leader implícito).
 * 2) Vladimir: VIEW solo lectura oficina CFL (sin export) — auditoría cruzada temporal.
 */
async function seedExamples(conn) {
  const db = config.target.database;

  const vladimir = await findUser(conn, db, 'vladimirfulcado12@gmail.com');
  const tony = await findUser(conn, db, 'tpress@thenofaultgroup.com');
  const cfl = await findOffice(conn, db, 'CFL');

  if (!vladimir) {
    console.log('  ⚠ Ejemplo omitido: no está vladimirfulcado12@gmail.com en app_user (copy-users primero)');
    return 0;
  }

  let n = 0;
  const now = new Date();
  const in30 = new Date(now);
  in30.setDate(in30.getDate() + 30);

  if (tony) {
    await upsertGrant(conn, db, [
      vladimir.id_user,
      LEVEL.TEAM,
      null,
      tony.id_user,
      'VIEW',
      1,
      now,
      in30,
      'Ejemplo: ver y exportar team ajeno (Tony Press) sin editar',
      tony.id_user,
    ]);
    n += 1;
    console.log(
      `  ✓ Grant 1: ${vladimir.email} → TEAM de ${tony.email}: VIEW + can_export (30 días)`
    );
  } else {
    console.log('  ⚠ Grant 1 omitido: tpress@thenofaultgroup.com no en app_user');
  }

  if (cfl) {
    await upsertGrant(conn, db, [
      vladimir.id_user,
      LEVEL.OFFICE,
      cfl.id_company_office,
      null,
      'VIEW',
      0,
      now,
      in30,
      'Ejemplo: solo ver oficina CFL (sin export ni edit)',
      tony?.id_user ?? null,
    ]);
    n += 1;
    console.log(
      `  ✓ Grant 2: ${vladimir.email} → OFFICE ${cfl.office_code}: VIEW sin export (30 días)`
    );
  }

  return n;
}

async function main() {
  console.log(`user_access_grant — ejemplo en ${config.target.database}\n`);

  await withTarget(async (conn) => {
    await ensureTable(conn);
    const n = await seedExamples(conn);
    const db = config.target.database;
    const [[{ total }]] = await conn.query(
      `SELECT COUNT(*) AS total FROM \`${db}\`.user_access_grant`
    );
    console.log(`\nTotal grants: ${total} (${n} ejemplo(s) en esta corrida)`);
  });

  await closeAll();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
