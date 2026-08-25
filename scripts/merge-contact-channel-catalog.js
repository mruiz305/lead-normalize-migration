#!/usr/bin/env node
/** Fusiona ref_contact_medium → medium_code en ref_contact_channel_type (1 tabla). */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

async function tableExists(conn, db, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
    [db, table]
  );
  return rows.length > 0;
}

async function columnExists(conn, db, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [db, table, column]
  );
  return rows.length > 0;
}

async function fkExists(conn, db, table, fkName) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?
       AND CONSTRAINT_TYPE = 'FOREIGN KEY' LIMIT 1`,
    [db, table, fkName]
  );
  return rows.length > 0;
}

async function mergeToSingleTable(conn, db) {
  if (!(await tableExists(conn, db, 'ref_contact_medium'))) {
    if (await columnExists(conn, db, 'ref_contact_channel_type', 'medium_code')) {
      console.log('  · catálogo contacto ya es 1 tabla');
    } else if (await tableExists(conn, db, 'ref_contact_channel_type')) {
      console.log('  ⚠ ref_contact_channel_type sin medium_code — ejecuta bootstrap o patch:contact-channel');
    }
    return;
  }

  if (!(await columnExists(conn, db, 'ref_contact_channel_type', 'medium_code'))) {
    await conn.query(`
      ALTER TABLE \`${db}\`.ref_contact_channel_type
        ADD COLUMN medium_code varchar(20) DEFAULT NULL AFTER id_channel_type
    `);
    console.log('  ✓ ref_contact_channel_type + medium_code');
  }

  await conn.query(`
    UPDATE \`${db}\`.ref_contact_channel_type ct
    INNER JOIN \`${db}\`.ref_contact_medium m ON m.id_medium = ct.id_medium
    SET ct.medium_code = m.medium_code
    WHERE ct.medium_code IS NULL
  `);
  console.log('  ✓ backfill medium_code');

  if (await fkExists(conn, db, 'ref_contact_channel_type', 'fk_channel_type_medium')) {
    await conn.query(`
      ALTER TABLE \`${db}\`.ref_contact_channel_type DROP FOREIGN KEY fk_channel_type_medium
    `);
    console.log('  ✓ drop fk_channel_type_medium');
  }

  await conn.query(`
    ALTER TABLE \`${db}\`.ref_contact_channel_type
      DROP COLUMN id_medium,
      MODIFY COLUMN medium_code varchar(20) NOT NULL,
      ADD KEY idx_contact_channel_medium (medium_code)
  `);
  console.log('  ✓ drop id_medium');

  await conn.query(`DROP TABLE \`${db}\`.ref_contact_medium`);
  console.log('  ✓ drop ref_contact_medium');
}

async function applyFlatView(conn) {
  const sql = fs.readFileSync(path.join(config.sqlDir, '03_view_tblLeads_flat.sql'), 'utf8');
  await conn.query(sql);
  console.log('  ✓ vista v_tblLeads_flat');
}

async function main() {
  const db = config.target.database;
  console.log(`Fusionar catálogo contacto → 1 tabla en ${db}…\n`);

  await withTarget(async (conn) => {
    await mergeToSingleTable(conn, db);
    try {
      await applyFlatView(conn);
    } catch (e) {
      console.log(`  ⚠ vista flat: ${e.message}`);
    }
  });

  await closeAll();
  console.log('\nref_contact_channel_type (medium_code + type_code).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
