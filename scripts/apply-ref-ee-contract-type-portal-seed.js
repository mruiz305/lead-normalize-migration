#!/usr/bin/env node
/** ref_ee_contract_type: EE Contract Type del portal User Management. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

async function main() {
  const db = config.target.database;
  console.log(`ref_ee_contract_type portal seed en ${db}…\n`);

  await withTarget(async (conn) => {
    const sql = fs.readFileSync(
      path.join(config.sqlDir, 'patches', 'ref_ee_contract_type_portal_seed.sql'),
      'utf8',
    );
    await conn.query(sql);
    console.log('  ✓ W2, 1099, INTM, INTM2');
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
