#!/usr/bin/env node
/** Marca RESIDENCE más reciente como is_primary=1. npm run patch:backfill-client-address-primary */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

async function main() {
  const db = config.target.database;
  console.log(`backfill client_address is_primary en ${db}…\n`);

  await withTarget(async (conn) => {
    const sql = fs.readFileSync(
      path.join(
        config.sqlDir,
        'patches',
        'backfill_client_address_primary_residence.sql',
      ),
      'utf8',
    );
    const [result] = await conn.query(sql);
    console.log(`  ✓ filas actualizadas: ${result.affectedRows ?? 0}`);
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
