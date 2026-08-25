#!/usr/bin/env node
/** Renombra ref_geo_state → ref_state (tabla + índices). */

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

async function main() {
  const db = config.target.database;
  console.log(`Renombrar ref_geo_state → ref_state en ${db}…\n`);

  await withTarget(async (conn) => {
    if (await tableExists(conn, db, 'ref_state')) {
      console.log('  · ref_state ya existe');
      return;
    }
    if (!(await tableExists(conn, db, 'ref_geo_state'))) {
      console.log('  · ref_geo_state no existe — nada que renombrar');
      return;
    }

    await conn.query(`RENAME TABLE \`${db}\`.ref_geo_state TO \`${db}\`.ref_state`);
    await conn.query(`
      ALTER TABLE \`${db}\`.ref_state
        RENAME INDEX uk_geo_state_code TO uk_state_code,
        RENAME INDEX uk_geo_state_name TO uk_state_name
    `);
    console.log('  ✓ ref_geo_state → ref_state');

    const viewSql = fs.readFileSync(path.join(config.sqlDir, '03_view_tblLeads_flat.sql'), 'utf8');
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
