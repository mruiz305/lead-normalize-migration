#!/usr/bin/env node
/** Limpia user_hr_period (sin legacy_g_users_id, source, email duplicado) y re-sincroniza. */

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

async function indexExists(conn, db, table, indexName) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [db, table, indexName]
  );
  return rows.length > 0;
}

async function dropColumnIfExists(conn, db, table, column) {
  if (await columnExists(conn, db, table, column)) {
    await conn.query(`ALTER TABLE \`${db}\`.\`${table}\` DROP COLUMN \`${column}\``);
    console.log(`  ✓ DROP ${table}.${column}`);
  }
}

async function dropIndexIfExists(conn, db, table, indexName) {
  if (await indexExists(conn, db, table, indexName)) {
    await conn.query(`ALTER TABLE \`${db}\`.\`${table}\` DROP INDEX \`${indexName}\``);
    console.log(`  ✓ DROP INDEX ${table}.${indexName}`);
  }
}

async function ensureUniqueUserStint(conn, db) {
  if (await indexExists(conn, db, TABLE, 'uk_hr_period_user_stint')) return;
  await conn.query(`
    ALTER TABLE \`${db}\`.\`${TABLE}\`
      ADD UNIQUE KEY uk_hr_period_user_stint (id_user, stint_order)
  `);
  console.log(`  ✓ ADD uk_hr_period_user_stint`);
}

async function applyView(conn) {
  const sql = fs.readFileSync(path.join(config.sqlDir, '05_view_user_rehire_stats.sql'), 'utf8');
  await conn.query(sql);
  console.log('  ✓ vista v_user_rehire_stats');
}

async function main() {
  const db = config.target.database;
  console.log(`Limpiando ${TABLE} en ${db}…\n`);

  await withTarget(async (targetConn) => {
    const hasLegacy =
      (await columnExists(targetConn, db, TABLE, 'legacy_g_users_id')) ||
      (await columnExists(targetConn, db, TABLE, 'source')) ||
      (await columnExists(targetConn, db, TABLE, 'email'));

    if (hasLegacy) {
      await targetConn.query('SET FOREIGN_KEY_CHECKS = 0');
      await targetConn.query(`TRUNCATE TABLE \`${db}\`.${TABLE}`);

      for (const idx of [
        'uk_employment_legacy_g_users',
        'uk_hr_period_legacy_g_users',
        'idx_employment_user_stint',
        'idx_hr_period_user_stint',
      ]) {
        await dropIndexIfExists(targetConn, db, TABLE, idx);
      }

      for (const col of ['legacy_g_users_id', 'email', 'display_name', 'source']) {
        await dropColumnIfExists(targetConn, db, TABLE, col);
      }

      await ensureUniqueUserStint(targetConn, db);
      await targetConn.query('SET FOREIGN_KEY_CHECKS = 1');
      console.log('');
    } else {
      console.log(`  · ${TABLE} ya tiene esquema limpio\n`);
    }

    await withSource(async (sourceConn) => {
      console.log('Re-sincronizando pasadas HR…');
      await syncUserHrPeriod(sourceConn, targetConn, { truncate: true });
    });

    await applyView(targetConn);
  });

  await closeAll();
  console.log('\nuser_hr_period alineado (persona → app_user; sin columnas legacy).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
