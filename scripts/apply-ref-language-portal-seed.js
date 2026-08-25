#!/usr/bin/env node
/** ref_language: idiomas preferidos del portal (New Lead / Demographics). */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

async function main() {
  const db = config.target.database;
  console.log(`ref_language portal seed en ${db}…\n`);

  await withTarget(async (conn) => {
    const sql = fs.readFileSync(
      path.join(config.sqlDir, 'patches', 'ref_language_portal_seed.sql'),
      'utf8',
    );
    await conn.query(sql);
    console.log('  ✓ English, Spanish, Creole, Portuguese, Other');
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
