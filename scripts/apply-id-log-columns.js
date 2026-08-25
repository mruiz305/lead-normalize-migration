#!/usr/bin/env node
/** Agrega id_log a tablas transaccionales. Uso: npm run patch:id-log-columns */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

const TABLES = [
  'client', 'client_channel', 'client_address', 'user_channel', 'user_access_grant',
  'lead', 'lead_accident', 'lead_legal', 'lead_clinical', 'lead_injury',
  'lead_injury_site', 'lead_org_snapshot', 'lead_party', 'lead_party_injury_site',
  'lead_insurance', 'lead_staff', 'lead_sync_flag',
];

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

async function main() {
  const db = config.target.database;
  console.log(`Agregando id_log en ${db}…\n`);

  await withTarget(async (conn) => {
    const sql = fs.readFileSync(path.join(config.sqlDir, 'patches', 'add_id_log_columns.sql'), 'utf8');
    const blocks = sql.split(/(?=ALTER TABLE)/).map((s) => s.trim()).filter((s) => s.startsWith('ALTER'));

    for (const block of blocks) {
      const m = block.match(/ALTER TABLE `?(\w+)`?/);
      const table = m?.[1];
      if (!table) continue;
      if (!(await tableExists(conn, db, table))) {
        console.log(`  · ${table} — omitida (no existe)`);
        continue;
      }
      if (await columnExists(conn, db, table, 'id_log')) {
        console.log(`  · ${table} — ya tiene id_log`);
        continue;
      }
      await conn.query(block);
      console.log(`  ✓ ${table}.id_log`);
    }
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
