#!/usr/bin/env node
/** ref_injury_site: portal_sort_order + 23 opciones Edit Lead (hardcode Portal). */

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

async function main() {
  const db = config.target.database;
  console.log(`ref_injury_site portal picklist en ${db}…\n`);

  await withTarget(async (conn) => {
    if (!(await columnExists(conn, db, 'ref_injury_site', 'portal_sort_order'))) {
      await conn.query(
        `ALTER TABLE \`${db}\`.ref_injury_site
           ADD COLUMN portal_sort_order smallint DEFAULT NULL
             COMMENT 'Orden picklist Edit Lead Portal' AFTER is_active`,
      );
      console.log('  ✓ + portal_sort_order');
    } else {
      console.log('  · portal_sort_order ya existe');
    }

    const sql = fs.readFileSync(
      path.join(config.sqlDir, 'patches', 'ref_injury_site_portal_seed.sql'),
      'utf8',
    );
    await conn.query(sql);
    console.log('  ✓ 23 sitios de lesión Portal (INSERT/UPDATE)');
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
