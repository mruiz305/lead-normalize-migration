#!/usr/bin/env node
/** lead_accident: ref_at_fault_type + ref_accident_location_type (FK, drop varchar legacy). */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, withSource, closeAll } = require('../src/db');
const config = require('../src/config');
const { syncAtFaultTypeCatalog, relinkLeadAccidentAtFaultTypes } = require('../src/migration/atFaultTypeCatalog');
const {
  seedAccidentLocationTypes,
  relinkLeadAccidentLocationTypes,
} = require('../src/migration/accidentLocationTypeCatalog');

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

async function upgradeLeadAccidentColumns(conn, db) {
  const alters = [];
  if (!(await columnExists(conn, db, 'lead_accident', 'id_location_type'))) {
    alters.push('ADD COLUMN id_location_type tinyint DEFAULT NULL AFTER id_rep_state');
  }
  if (!(await columnExists(conn, db, 'lead_accident', 'id_at_fault_type'))) {
    alters.push('ADD COLUMN id_at_fault_type smallint DEFAULT NULL AFTER id_location_type');
  }
  if (!(await columnExists(conn, db, 'lead_accident', 'id_at_fault_sub_type'))) {
    alters.push('ADD COLUMN id_at_fault_sub_type smallint DEFAULT NULL AFTER id_at_fault_type');
  }
  if (alters.length) {
    await conn.query(`ALTER TABLE \`${db}\`.lead_accident ${alters.join(', ')}`);
    console.log('  ✓ lead_accident + id_location_type, id_at_fault_type, id_at_fault_sub_type');
  } else {
    console.log('  · lead_accident ya tiene columnas FK');
  }
}

async function dropLegacyAccidentColumns(conn, db) {
  const toDrop = [];
  for (const col of ['location_type', 'at_fault_type', 'at_fault_sub_type']) {
    if (await columnExists(conn, db, 'lead_accident', col)) toDrop.push(col);
  }
  if (!toDrop.length) {
    console.log('  · lead_accident ya sin columnas varchar legacy');
    return;
  }
  await conn.query(
    `ALTER TABLE \`${db}\`.lead_accident DROP COLUMN ${toDrop.map((c) => `\`${c}\``).join(', DROP COLUMN ')}`
  );
  console.log(`  ✓ drop ${toDrop.join(', ')}`);
}

async function ensureForeignKeys(conn, db) {
  const fks = [
    {
      name: 'fk_lead_accident_location',
      sql: `ADD CONSTRAINT fk_lead_accident_location FOREIGN KEY (id_location_type)
            REFERENCES ref_accident_location_type (id_location_type)`,
    },
    {
      name: 'fk_lead_accident_at_fault_type',
      sql: `ADD CONSTRAINT fk_lead_accident_at_fault_type FOREIGN KEY (id_at_fault_type)
            REFERENCES ref_at_fault_type (id_at_fault_type)`,
    },
    {
      name: 'fk_lead_accident_at_fault_sub',
      sql: `ADD CONSTRAINT fk_lead_accident_at_fault_sub FOREIGN KEY (id_at_fault_sub_type)
            REFERENCES ref_at_fault_type (id_at_fault_type)`,
    },
  ];
  for (const fk of fks) {
    if (await fkExists(conn, db, 'lead_accident', fk.name)) continue;
    await conn.query(`ALTER TABLE \`${db}\`.lead_accident ${fk.sql}`);
    console.log(`  ✓ ${fk.name}`);
  }
}

async function main() {
  const db = config.target.database;
  console.log(`Catálogos accidente en ${db}…\n`);

  await withTarget(async (targetConn) => {
    const baseSql = fs.readFileSync(
      path.join(config.sqlDir, 'patches', 'accident_catalogs.sql'),
      'utf8'
    );
    await targetConn.query(baseSql);
    console.log('  ✓ ref_accident_location_type + ref_at_fault_type');

    await seedAccidentLocationTypes(targetConn);
    await upgradeLeadAccidentColumns(targetConn, db);

    await withSource(async (sourceConn) => {
      await syncAtFaultTypeCatalog(sourceConn, targetConn, { truncate: true });
    });

    const locLinked = await relinkLeadAccidentLocationTypes(targetConn);
    console.log(`  ✓ id_location_type backfill: ${locLinked} filas`);

    await relinkLeadAccidentAtFaultTypes(targetConn);
    console.log('  ✓ id_at_fault_type / id_at_fault_sub_type backfill');

    await dropLegacyAccidentColumns(targetConn, db);
    await ensureForeignKeys(targetConn, db);

    const viewSql = fs.readFileSync(
      path.join(config.sqlDir, '03_view_tblLeads_flat.sql'),
      'utf8'
    );
    await targetConn.query(viewSql);
    console.log('  ✓ vista v_tblLeads_flat');
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
