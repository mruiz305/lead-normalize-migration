#!/usr/bin/env node
/** Aplica modelo limpio en destino ya migrado: quita hierarchy_node y columnas FK redundantes. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
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

async function tableExists(conn, db, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
    [db, table]
  );
  return rows.length > 0;
}

async function fkExists(conn, db, table, fkName) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY' LIMIT 1`,
    [db, table, fkName]
  );
  return rows.length > 0;
}

async function dropFkIfExists(conn, db, table, fkName) {
  if (await fkExists(conn, db, table, fkName)) {
    await conn.query(`ALTER TABLE \`${db}\`.\`${table}\` DROP FOREIGN KEY \`${fkName}\``);
    console.log(`  ✓ DROP FK ${table}.${fkName}`);
  }
}

async function dropIndexIfExists(conn, db, table, indexName) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [db, table, indexName]
  );
  if (rows.length) {
    await conn.query(`ALTER TABLE \`${db}\`.\`${table}\` DROP INDEX \`${indexName}\``);
    console.log(`  ✓ DROP INDEX ${table}.${indexName}`);
  }
}

async function dropColumnIfExists(conn, db, table, column) {
  if (await columnExists(conn, db, table, column)) {
    await conn.query(`ALTER TABLE \`${db}\`.\`${table}\` DROP COLUMN \`${column}\``);
    console.log(`  ✓ DROP COLUMN ${table}.${column}`);
  }
}

async function main() {
  const db = config.target.database;
  console.log(`Aplicando modelo limpio en ${db}…\n`);

  await withTarget(async (conn) => {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    await dropFkIfExists(conn, db, 'lead', 'fk_lead_office');
    await dropIndexIfExists(conn, db, 'lead', 'idx_lead_office');
    await dropColumnIfExists(conn, db, 'lead', 'owning_office_node_id');

    const snapshotFks = [
      'fk_org_dir_node', 'fk_org_reg_node', 'fk_org_off_node',
      'fk_org_pod_node', 'fk_org_team_node', 'fk_org_duo_node',
    ];
    for (const fk of snapshotFks) {
      await dropFkIfExists(conn, db, 'lead_org_snapshot', fk);
    }
    await dropIndexIfExists(conn, db, 'lead_org_snapshot', 'idx_org_office_node');
    await dropIndexIfExists(conn, db, 'lead_org_snapshot', 'idx_org_team_node');

    for (const col of [
      'directorate_node_id', 'region_node_id', 'office_node_id',
      'pod_node_id', 'team_node_id', 'duo_node_id',
    ]) {
      await dropColumnIfExists(conn, db, 'lead_org_snapshot', col);
    }

    if (await tableExists(conn, db, 'hierarchy_node')) {
      await conn.query(`DROP TABLE \`${db}\`.hierarchy_node`);
      console.log('  ✓ DROP TABLE hierarchy_node');
    } else {
      console.log('  · hierarchy_node ya no existe');
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('\nModelo limpio aplicado.');
  });

  await closeAll();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
