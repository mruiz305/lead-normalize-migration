#!/usr/bin/env node
/** ref_accident_or_wc: Accident vs Workers Comp del portal Edit Lead. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

async function main() {
  const db = config.target.database;
  console.log(`ref_accident_or_wc portal seed en ${db}…\n`);

  await withTarget(async (conn) => {
    const sql = fs.readFileSync(
      path.join(config.sqlDir, 'patches', 'ref_accident_or_wc_portal_seed.sql'),
      'utf8',
    );
    await conn.query(sql);

    const [rows] = await conn.query(
      `SELECT type_code, display_name, tx_group, sort_order
       FROM ref_accident_or_wc
       WHERE is_active = 1
       ORDER BY sort_order ASC, display_name ASC`,
    );
    console.log('  ✓ catálogo Accident vs Workers Comp:');
    for (const row of rows) {
      const tx = row.tx_group ? ` (tx_group=${row.tx_group})` : '';
      console.log(`    - [${row.sort_order}] ${row.display_name} → ${row.type_code}${tx}`);
    }
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
