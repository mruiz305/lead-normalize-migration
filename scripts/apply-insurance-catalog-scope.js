#!/usr/bin/env node
/** ref_insurance_carrier: catalog_scope PIP | AT_FAULT (sync prod refInsurance + relink lead_insurance). */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, withSource, closeAll } = require('../src/db');
const config = require('../src/config');
const {
  syncInsuranceCatalog,
  relinkLeadInsuranceCarriers,
} = require('../src/migration/insurance');

async function columnExists(conn, db, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [db, table, column]
  );
  return rows.length > 0;
}

async function indexExists(conn, db, table, indexName) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [db, table, indexName]
  );
  return rows.length > 0;
}

async function upgradeSchema(conn, db) {
  if (!(await columnExists(conn, db, 'ref_insurance_carrier', 'catalog_scope'))) {
    const sql = fs.readFileSync(
      path.join(config.sqlDir, 'patches', 'insurance_catalog_scope.sql'),
      'utf8'
    );
    await conn.query(sql);
    console.log('  ✓ catalog_scope + uk_carrier_scope');
    return true;
  }

  if (!(await indexExists(conn, db, 'ref_insurance_carrier', 'uk_carrier_scope'))) {
    if (await indexExists(conn, db, 'ref_insurance_carrier', 'uk_carrier_normalized')) {
      await conn.query(`ALTER TABLE \`${db}\`.ref_insurance_carrier DROP INDEX uk_carrier_normalized`);
    }
    await conn.query(
      `ALTER TABLE \`${db}\`.ref_insurance_carrier
         ADD UNIQUE KEY uk_carrier_scope (normalized_name, catalog_scope),
         ADD KEY idx_carrier_scope (catalog_scope)`
    );
    console.log('  ✓ uk_carrier_scope');
  } else {
    console.log('  · esquema ya con catalog_scope');
  }
  return false;
}

async function main() {
  const db = config.target.database;
  console.log(`Seguros PIP / AT_FAULT en ${db}…\n`);

  await withTarget(async (targetConn) => {
    await upgradeSchema(targetConn, db);

    await withSource(async (sourceConn) => {
      console.log('  Resync refInsurance prod → ref_insurance_carrier…');
      await syncInsuranceCatalog(sourceConn, targetConn, { truncate: true });
    });

    const linked = await relinkLeadInsuranceCarriers(targetConn);
    console.log(`  ✓ lead_insurance relink: ${linked} filas`);
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
