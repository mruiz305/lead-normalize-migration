#!/usr/bin/env node
/** ref_hr_status: HR Status del portal User Management Edit User. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

async function main() {
  const db = config.target.database;
  console.log(`ref_hr_status portal seed en ${db}…\n`);

  await withTarget(async (conn) => {
    const sql = fs.readFileSync(
      path.join(config.sqlDir, 'patches', 'ref_hr_status_portal_seed.sql'),
      'utf8',
    );
    await conn.query(sql);

    const [rows] = await conn.query(
      `SELECT status_code, display_name, sort_order
       FROM ref_hr_status
       WHERE is_active = 1
       ORDER BY sort_order ASC, display_name ASC`,
    );
    console.log('  ✓ HR Status Edit User:');
    for (const row of rows) {
      console.log(`    - ${row.display_name} → form "${row.status_code}"`);
    }
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
