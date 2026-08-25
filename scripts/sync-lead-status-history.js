#!/usr/bin/env node
/** Crea lead_status_event y sincroniza histórico desde prod. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, withSource, closeAll } = require('../src/db');
const config = require('../src/config');
const { loadCatalogMaps } = require('../src/migration/maps');
const { syncLeadStatusEvents, TABLE } = require('../src/migration/leadStatusEvent');

async function tableExists(conn, db, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
    [db, table]
  );
  return rows.length > 0;
}

async function ensureSchema(conn, db) {
  if (await tableExists(conn, db, TABLE)) {
    console.log(`  · ${TABLE} ya existe`);
    return;
  }
  const sql = fs.readFileSync(path.join(config.sqlDir, 'patches', 'add_lead_status_event.sql'), 'utf8');
  await conn.query(sql);
  console.log(`  ✓ ${TABLE} creada`);
}

async function main() {
  const truncate = !process.argv.includes('--no-truncate');
  const db = config.target.database;
  console.log(`Histórico estados (${TABLE}) en ${db}${truncate ? '' : ' (append)'}\n`);

  await withTarget(async (targetConn) => {
    await ensureSchema(targetConn, db);
    const maps = await loadCatalogMaps(targetConn);
    await withSource(async (sourceConn) => {
      await syncLeadStatusEvents(sourceConn, targetConn, maps, { truncate });
    });
  });

  await closeAll();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
