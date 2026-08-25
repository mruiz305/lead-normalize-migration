#!/usr/bin/env node
/** lead.id_lead AUTO_INCREMENT; contador = MAX(id_lead)+1 tras migración. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

async function main() {
  const db = config.target.database;
  console.log(`lead.id_lead AUTO_INCREMENT en ${db}…\n`);

  await withTarget(async (conn) => {
    const sql = fs.readFileSync(
      path.join(config.sqlDir, 'patches', 'lead_id_auto_increment.sql'),
      'utf8',
    );
    await conn.query(sql);

    const [[{ maxId, nextId }]] = await conn.query(
      `SELECT COALESCE(MAX(id_lead), 0) AS maxId,
              COALESCE(MAX(id_lead), 0) + 1 AS nextId
       FROM \`${db}\`.\`lead\``,
    );
    const autoInc = Number(nextId) || 1;
    await conn.query(`ALTER TABLE \`${db}\`.\`lead\` AUTO_INCREMENT = ?`, [autoInc]);

    console.log(`  ✓ id_lead AUTO_INCREMENT (siguiente id: ${autoInc}, max migrado: ${maxId})`);
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
