#!/usr/bin/env node
/** user_channel + backfill desde g_users (phone, email, fbHandle, igHandle). */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, withSource, closeAll } = require('../src/db');
const config = require('../src/config');
const { syncUserChannelsFromGUsers } = require('../src/migration/userChannelSync');

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
  const truncate = process.argv.includes('--truncate');
  console.log(`user_channel en ${db}…\n`);

  await withTarget(async (targetConn) => {
    if (!(await tableExists(targetConn, db, 'user_channel'))) {
      const sql = fs.readFileSync(path.join(config.sqlDir, 'patches', 'user_channel.sql'), 'utf8');
      await targetConn.query(sql);
      console.log('  ✓ tabla user_channel creada');
    } else {
      console.log('  · user_channel ya existe');
    }

    await withSource(async (sourceConn) => {
      const stats = await syncUserChannelsFromGUsers(sourceConn, targetConn, { truncate });
      console.log(`  ✓ g_users leídos: ${stats.gUsers}`);
      console.log(`  ✓ canales generados: ${stats.channelRows} (${stats.inserted} nuevos)`);
      console.log(`  ✓ user_channel total: ${stats.total}`);
    });
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
