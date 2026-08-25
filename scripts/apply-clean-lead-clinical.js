#!/usr/bin/env node
/** lead_clinical: drop tx_group, insurance dupes; vista flat desde lead_insurance. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

async function columnExists(conn, db, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [db, table, column]
  );
  return rows.length > 0;
}

async function dropColumnsIfExist(conn, db, table, columns) {
  const toDrop = [];
  for (const col of columns) {
    if (await columnExists(conn, db, table, col)) toDrop.push(col);
  }
  if (!toDrop.length) return false;
  await conn.query(
    `ALTER TABLE \`${db}\`.${table} DROP COLUMN ${toDrop.map((c) => `\`${c}\``).join(', DROP COLUMN ')}`
  );
  return toDrop;
}

async function main() {
  const db = config.target.database;
  console.log(`Limpiar lead_clinical en ${db}…\n`);

  await withTarget(async (conn) => {
    const droppedTx = await dropColumnsIfExist(conn, db, 'lead_clinical', ['tx_group', 'tx_contract_group']);
    if (droppedTx.length) {
      console.log(`  ✓ drop ${droppedTx.join(', ')}`);
    } else {
      console.log('  · lead_clinical ya sin tx_group / tx_contract_group');
    }

    const droppedIns = await dropColumnsIfExist(conn, db, 'lead_clinical', ['pip_insurance', 'at_fault_insurance']);
    if (droppedIns.length) {
      console.log(`  ✓ drop ${droppedIns.join(', ')} (canónico: lead_insurance)`);
    } else {
      console.log('  · lead_clinical ya sin pip_insurance / at_fault_insurance');
    }

    const viewSql = fs.readFileSync(
      path.join(config.sqlDir, '03_view_tblLeads_flat.sql'),
      'utf8'
    );
    await conn.query(viewSql);
    console.log('  ✓ vista v_tblLeads_flat');
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
