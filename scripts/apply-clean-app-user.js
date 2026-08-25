#!/usr/bin/env node
/** Quita columnas duplicadas de app_user (hierarchy_* + office_code). */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

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

async function main() {
  const db = config.target.database;
  console.log(`Limpiando app_user en ${db}…\n`);

  await withTarget(async (conn) => {
    await dropIndexIfExists(conn, db, 'app_user', 'idx_app_user_hierarchy_office');
    await dropIndexIfExists(conn, db, 'app_user', 'idx_app_user_office_code');

    for (const col of [
      'hierarchy_directorate',
      'hierarchy_region',
      'hierarchy_office',
      'hierarchy_pod',
      'hierarchy_team',
      'hierarchy_duo',
      'office_code',
    ]) {
      await dropColumnIfExists(conn, db, 'app_user', col);
    }

    console.log('\napp_user limpio (jerarquía → hierarchy_membership, oficina → id_company_office).');
  });

  await closeAll();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
