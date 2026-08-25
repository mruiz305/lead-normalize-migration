#!/usr/bin/env node
/** lead_accident: ref_severity_level + vehicle_description; drop property/personal varchar. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, withSource, closeAll } = require('../src/db');
const config = require('../src/config');
const {
  seedSeverityLevels,
  syncSeverityFromLeads,
  relinkLeadAccidentSeverity,
} = require('../src/migration/severityLevelCatalog');

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

async function upgradeLeadAccident(conn, db) {
  const alters = [];
  if (!(await columnExists(conn, db, 'lead_accident', 'id_property_severity'))) {
    alters.push('ADD COLUMN id_property_severity tinyint DEFAULT NULL AFTER id_at_fault_sub_type');
  }
  if (!(await columnExists(conn, db, 'lead_accident', 'id_personal_severity'))) {
    alters.push('ADD COLUMN id_personal_severity tinyint DEFAULT NULL AFTER id_property_severity');
  }
  if (alters.length) {
    await conn.query(`ALTER TABLE \`${db}\`.lead_accident ${alters.join(', ')}`);
    console.log('  ✓ + id_property_severity, id_personal_severity');
  }

  const hasOldVehicle = await columnExists(conn, db, 'lead_accident', 'vehicle_model_year');
  const hasNewVehicle = await columnExists(conn, db, 'lead_accident', 'vehicle_description');
  if (hasOldVehicle && !hasNewVehicle) {
    await conn.query(
      `ALTER TABLE \`${db}\`.lead_accident
         CHANGE COLUMN vehicle_model_year vehicle_description varchar(255) DEFAULT NULL`
    );
    console.log('  ✓ vehicle_model_year → vehicle_description');
  } else if (!hasNewVehicle) {
    await conn.query(
      `ALTER TABLE \`${db}\`.lead_accident
         ADD COLUMN vehicle_description varchar(255) DEFAULT NULL AFTER id_at_fault_sub_type`
    );
    console.log('  ✓ + vehicle_description');
  } else {
    console.log('  · vehicle_description ya existe');
  }
}

async function dropLegacyColumns(conn, db) {
  const toDrop = [];
  for (const col of ['property_damage', 'personal_injury', 'vehicle_model_year']) {
    if (await columnExists(conn, db, 'lead_accident', col)) toDrop.push(col);
  }
  if (!toDrop.length) {
    console.log('  · sin columnas legacy property/personal/vehicle_model_year');
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
      name: 'fk_lead_accident_property_sev',
      sql: `ADD CONSTRAINT fk_lead_accident_property_sev FOREIGN KEY (id_property_severity)
            REFERENCES ref_severity_level (id_severity)`,
    },
    {
      name: 'fk_lead_accident_personal_sev',
      sql: `ADD CONSTRAINT fk_lead_accident_personal_sev FOREIGN KEY (id_personal_severity)
            REFERENCES ref_severity_level (id_severity)`,
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
  console.log(`Severidad accidente en ${db}…\n`);

  await withTarget(async (targetConn) => {
    const baseSql = fs.readFileSync(
      path.join(config.sqlDir, 'patches', 'accident_severity.sql'),
      'utf8'
    );
    await targetConn.query(baseSql);
    console.log('  ✓ ref_severity_level');

    await upgradeLeadAccident(targetConn, db);

    await withSource(async (sourceConn) => {
      const added = await syncSeverityFromLeads(sourceConn, targetConn);
      if (added) console.log(`  ✓ ref_severity_level +${added} extras desde tblLeads`);
    });

    await relinkLeadAccidentSeverity(targetConn);
    console.log('  ✓ id_property_severity / id_personal_severity backfill');

    await dropLegacyColumns(targetConn, db);
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
