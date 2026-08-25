#!/usr/bin/env node
/** ref_comment_source: orígenes del chat lead_note (Intake, Attorney, Clinic). */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

async function main() {
  const db = config.target.database;
  console.log(`ref_comment_source portal seed en ${db}…\n`);

  await withTarget(async (conn) => {
    const sql = fs.readFileSync(
      path.join(config.sqlDir, 'patches', 'ref_comment_source_portal_seed.sql'),
      'utf8',
    );
    await conn.query(sql);

    const [rows] = await conn.query(
      `SELECT origin_code, display_name, sort_order
       FROM ref_comment_source
       WHERE is_active = 1
       ORDER BY sort_order ASC, display_name ASC`,
    );
    console.log('  ✓ Comment sources (chat):');
    for (const row of rows) {
      console.log(`    - ${row.display_name} → origin "${row.origin_code}"`);
    }
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
