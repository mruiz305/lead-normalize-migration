#!/usr/bin/env node
/** Quita columnas legacy de lead_status_event (texto, origen, email sin FK). */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

async function tableExists(conn, db, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
    [db, table]
  );
  return rows.length > 0;
}

async function columnExists(conn, db, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [db, table, column]
  );
  return rows.length > 0;
}

async function main() {
  const db = config.target.database;
  console.log(`Limpieza lead_status_event en ${db}…\n`);

  await withTarget(async (conn) => {
    if (!(await tableExists(conn, db, 'lead_status_event'))) {
      console.log('  · lead_status_event no existe — nada que hacer');
      return;
    }

    if (!(await columnExists(conn, db, 'lead_status_event', 'legacy_source'))) {
      console.log('  · esquema ya limpio');
      return;
    }

    const sql = fs.readFileSync(
      path.join(config.sqlDir, 'patches', 'clean_lead_status_event.sql'),
      'utf8'
    );
    await conn.query(sql.replace(/lead_status_event/g, `\`${db}\`.lead_status_event`));
    console.log('  ✓ columnas legacy eliminadas');
  });

  await closeAll();
  console.log('\nListo. lead_status_event solo guarda FKs + changed_at + changed_by_user_id.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
