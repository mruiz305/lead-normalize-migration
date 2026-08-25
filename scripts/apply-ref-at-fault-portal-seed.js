#!/usr/bin/env node
/** ref_at_fault_type: opciones At Fault del portal Edit Lead. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

async function main() {
  const db = config.target.database;
  console.log(`ref_at_fault_type portal seed en ${db}…\n`);

  await withTarget(async (conn) => {
    const sql = fs.readFileSync(
      path.join(config.sqlDir, 'patches', 'ref_at_fault_portal_seed.sql'),
      'utf8',
    );
    await conn.query(sql);
    console.log('  ✓ Unknown, No One Cited, 3rd Party Cited, Cited');
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
