#!/usr/bin/env node
/** ref_severity_level: columnas portal + filas N/A (0) y No Visible (5). */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

async function columnExists(conn, db, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [db, table, column],
  );
  return rows.length > 0;
}

async function ensurePortalColumns(conn, db) {
  const alters = [];
  if (!(await columnExists(conn, db, 'ref_severity_level', 'applies_property'))) {
    alters.push(
      "ADD COLUMN applies_property tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Catálogo Property Damage' AFTER is_active",
    );
  }
  if (!(await columnExists(conn, db, 'ref_severity_level', 'applies_personal'))) {
    alters.push(
      "ADD COLUMN applies_personal tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Catálogo Personal Injury' AFTER applies_property",
    );
  }
  if (!(await columnExists(conn, db, 'ref_severity_level', 'portal_code_property'))) {
    alters.push(
      "ADD COLUMN portal_code_property varchar(10) DEFAULT NULL COMMENT 'Código Portal Property' AFTER applies_personal",
    );
  }
  if (!(await columnExists(conn, db, 'ref_severity_level', 'portal_code_personal'))) {
    alters.push(
      "ADD COLUMN portal_code_personal varchar(10) DEFAULT NULL COMMENT 'Código Portal Personal' AFTER portal_code_property",
    );
  }
  if (!(await columnExists(conn, db, 'ref_severity_level', 'display_label_property'))) {
    alters.push(
      "ADD COLUMN display_label_property varchar(80) DEFAULT NULL COMMENT 'Label UI Property' AFTER portal_code_personal",
    );
  }
  if (!(await columnExists(conn, db, 'ref_severity_level', 'display_label_personal'))) {
    alters.push(
      "ADD COLUMN display_label_personal varchar(80) DEFAULT NULL COMMENT 'Label UI Personal' AFTER display_label_property",
    );
  }
  if (alters.length) {
    await conn.query(`ALTER TABLE \`${db}\`.ref_severity_level ${alters.join(', ')}`);
    console.log('  ✓ columnas portal en ref_severity_level');
  } else {
    console.log('  · columnas portal ya existen');
  }
}

async function main() {
  const db = config.target.database;
  console.log(`ref_severity_level portal catalog en ${db}…\n`);

  await withTarget(async (conn) => {
    await ensurePortalColumns(conn, db);
    const sql = fs.readFileSync(
      path.join(config.sqlDir, 'patches', 'ref_severity_portal_catalog.sql'),
      'utf8',
    );
    await conn.query(sql);
    console.log('  ✓ filas N/A (0), No Visible (5) y labels Mild…Major');
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
