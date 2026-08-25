#!/usr/bin/env node
/** Patch + backfill URLs operativas en app_user desde g_users. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, withSource, closeAll } = require('../src/db');
const config = require('../src/config');
const { syncUserDocUrlsFromGUsers } = require('../src/migration/userDocUrlSync');

async function columnExists(conn, db, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'app_user' AND COLUMN_NAME = ? LIMIT 1`,
    [db, column]
  );
  return rows.length > 0;
}

async function main() {
  const db = config.target.database;
  console.log(`Patch app_user doc URLs → ${db}\n`);

  await withTarget(async (targetConn) => {
    if (!(await columnExists(targetConn, db, 'individual_log_url'))) {
      const sql = fs.readFileSync(
        path.join(config.sqlDir, 'patches', 'add_app_user_doc_urls.sql'),
        'utf8'
      );
      await targetConn.query(sql);
      console.log('  ✓ columnas agregadas');
    } else {
      console.log('  · columnas ya existen');
    }

    await withSource(async (sourceConn) => {
      const { gUsers, updated, stats } = await syncUserDocUrlsFromGUsers(sourceConn, targetConn);
      console.log(`  ✓ g_users leídos: ${gUsers}`);
      console.log(`  ✓ app_user actualizados: ${updated}`);
      console.log(`  ✓ con log: ${stats.with_log}, roster: ${stats.with_roster}, machine: ${stats.with_machine}`);
      console.log(`  ✓ lead_sheet: ${stats.with_lead_sheet}, ind_lead_sheet: ${stats.with_ind_lead_sheet}`);
    });
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
