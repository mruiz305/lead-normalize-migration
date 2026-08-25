#!/usr/bin/env node
/** Crea entity_log + log_detail. Uso: npm run patch:entity-log */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

async function main() {
  const sql = fs.readFileSync(path.join(config.sqlDir, 'patches', 'add_entity_log.sql'), 'utf8');
  console.log(`Aplicando log transaccional en ${config.target.database}…\n`);

  await withTarget(async (conn) => {
    for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      await conn.query(stmt);
    }
    console.log('  ✓ entity_log');
    console.log('  ✓ log_detail');
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
