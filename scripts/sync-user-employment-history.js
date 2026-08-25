#!/usr/bin/env node
/** Patch/rename + sync user_hr_period desde g_users. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, withSource, closeAll } = require('../src/db');
const config = require('../src/config');
const { syncUserHrPeriod, TABLE } = require('../src/migration/userHrPeriod');

async function columnExists(conn, db, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [db, table, column]
  );
  return rows.length > 0;
}

async function tableExists(conn, db, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
    [db, table]
  );
  return rows.length > 0;
}

async function ensureSchema(conn) {
  const db = config.target.database;

  if (!(await columnExists(conn, db, 'app_user', 'hired_at'))) {
    await conn.query(`
      ALTER TABLE \`${db}\`.app_user
        ADD COLUMN hired_at datetime DEFAULT NULL COMMENT 'g_users.hrHired pasada actual' AFTER hr_status,
        ADD COLUMN termed_at datetime DEFAULT NULL COMMENT 'g_users.hrTermed pasada actual' AFTER hired_at
    `);
    console.log('  ✓ app_user + hired_at, termed_at');
  }

  if (await tableExists(conn, db, 'app_user_employment_period')) {
    await conn.query(`RENAME TABLE \`${db}\`.app_user_employment_period TO \`${db}\`.user_hr_period`);
    console.log('  ✓ renombrada app_user_employment_period → user_hr_period');
  } else if (!(await tableExists(conn, db, TABLE))) {
    const sql = fs.readFileSync(path.join(config.sqlDir, 'patches', 'add_user_hr_period.sql'), 'utf8');
    await conn.query(sql);
    console.log(`  ✓ ${TABLE} creada`);
  } else {
    console.log(`  · ${TABLE} ya existe`);
  }
}

async function backfillAppUserDatesFromPeriods(targetConn) {
  const tgt = config.target.database;
  const [result] = await targetConn.query(`
    UPDATE \`${tgt}\`.app_user u
    INNER JOIN \`${tgt}\`.${TABLE} p
      ON p.id_user = u.id_user AND p.is_current_stint = 1
    SET u.hired_at = p.hired_at,
        u.termed_at = p.termed_at,
        u.hr_status = COALESCE(p.hr_status, u.hr_status),
        u.is_active = CASE
          WHEN LOWER(TRIM(COALESCE(p.hr_status, ''))) = 'active' THEN 1
          WHEN LOWER(TRIM(COALESCE(p.hr_status, ''))) LIKE '%term%'
            OR LOWER(TRIM(COALESCE(p.hr_status, ''))) LIKE '%inactive%' THEN 0
          ELSE u.is_active
        END
  `);
  console.log(`  ✓ app_user fechas desde pasada actual: ${result.affectedRows} filas`);
}

async function applyView(conn) {
  const sql = fs.readFileSync(path.join(config.sqlDir, '05_view_user_rehire_stats.sql'), 'utf8');
  await conn.query(sql);
  console.log('  ✓ vista v_user_rehire_stats');
}

async function main() {
  console.log(`Histórico HR (${TABLE}) en ${config.target.database}\n`);

  await withTarget(async (targetConn) => {
    await ensureSchema(targetConn);
    await withSource(async (sourceConn) => {
      await syncUserHrPeriod(sourceConn, targetConn, { truncate: true });
      await backfillAppUserDatesFromPeriods(targetConn);
    });
    await applyView(targetConn);

    const db = config.target.database;
    const [top] = await targetConn.query(`
      SELECT email, display_name, employment_stints, times_left_and_returned
      FROM \`${db}\`.v_user_rehire_stats
      WHERE times_left_and_returned > 0
      ORDER BY times_left_and_returned DESC, employment_stints DESC
      LIMIT 5
    `);
    if (top.length) {
      console.log('\nEjemplos con reingreso:');
      for (const r of top) {
        console.log(
          `  ${r.email}: ${r.employment_stints} pasadas, ${r.times_left_and_returned} ida(s)/regreso(s)`
        );
      }
    }
  });

  await closeAll();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
