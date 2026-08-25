#!/usr/bin/env node
/** ref_attorney: modelo intake + id_state FK (sin ref_attorney_state). */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll, withSource } = require('../src/db');
const config = require('../src/config');
const { loadStateMap } = require('../src/migration/state');
const { syncAttorneyCatalog } = require('../src/migration/attorneyCatalog');

async function tableExists(conn, db, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
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

async function upgradeAttorneyColumns(conn, db) {
  if (!(await columnExists(conn, db, 'ref_attorney', 'attorney_code'))) return;

  const alters = [
    'CHANGE COLUMN attorney_code display_name varchar(255) NOT NULL',
    'CHANGE COLUMN emails_enabled is_emails_enabled tinyint(1) NOT NULL DEFAULT 1',
    'CHANGE COLUMN emails_ld_enabled is_emails_ld_enabled tinyint(1) NOT NULL DEFAULT 1',
    'CHANGE COLUMN is_miscellaneous is_misc tinyint(1) NOT NULL DEFAULT 0',
    'CHANGE COLUMN active_on_portal is_active_on_portal tinyint(1) NOT NULL DEFAULT 1',
    'CHANGE COLUMN source_changed_at updated_at datetime DEFAULT NULL',
  ];
  if (await columnExists(conn, db, 'ref_attorney', 'states')) {
    alters.push('DROP COLUMN states');
  }
  await conn.query(`ALTER TABLE \`${db}\`.ref_attorney ${alters.join(', ')}`);
  console.log('  ✓ columnas legacy → modelo intake');
}

async function upgradeStatusToIsActive(conn, db) {
  if (!(await columnExists(conn, db, 'ref_attorney', 'status'))) return;

  await conn.query(`
    ALTER TABLE \`${db}\`.ref_attorney
      ADD COLUMN is_active tinyint(1) NOT NULL DEFAULT 1 AFTER internal_source
  `);
  await conn.query(`
    UPDATE \`${db}\`.ref_attorney
    SET is_active = CASE WHEN UPPER(TRIM(status)) = 'ACTIVE' THEN 1 ELSE 0 END
  `);
  await conn.query(`
    ALTER TABLE \`${db}\`.ref_attorney
      DROP COLUMN status,
      ADD KEY idx_attorney_is_active (is_active)
  `);
  console.log('  ✓ status → is_active');
}

async function ensureIdStateColumn(conn, db) {
  if (!(await columnExists(conn, db, 'ref_attorney', 'id_state'))) {
    await conn.query(`
      ALTER TABLE \`${db}\`.ref_attorney
        ADD COLUMN id_state smallint DEFAULT NULL AFTER is_active,
        ADD KEY idx_attorney_state (id_state)
    `);
    console.log('  ✓ ref_attorney + id_state');
  }
  if (!(await fkExists(conn, db, 'ref_attorney', 'fk_attorney_state'))) {
    await conn.query(`
      ALTER TABLE \`${db}\`.ref_attorney
        ADD CONSTRAINT fk_attorney_state FOREIGN KEY (id_state)
          REFERENCES \`${db}\`.ref_state (id_state)
    `);
  }
}

async function dropAttorneyStateTable(conn, db) {
  if (!(await tableExists(conn, db, 'ref_attorney_state'))) return;
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  await conn.query(`DROP TABLE \`${db}\`.ref_attorney_state`);
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('  ✓ drop ref_attorney_state');
}

async function syncFromProd(conn, db) {
  const stateMap = await loadStateMap(conn);
  let stats;
  if (config.hasSeparateSource) {
    await withSource(async (sourceConn) => {
      stats = await syncAttorneyCatalog(sourceConn, conn, stateMap);
    });
  } else {
    stats = await syncAttorneyCatalog(conn, conn, stateMap);
  }
  console.log(`  ✓ sync prod → ${stats.attorneys} abogados, ${stats.withState} con id_state`);
  return stats;
}

async function applyFlatView(conn) {
  const sql = fs.readFileSync(path.join(config.sqlDir, '03_view_tblLeads_flat.sql'), 'utf8');
  await conn.query(sql);
  console.log('  ✓ vista v_tblLeads_flat');
}

async function report(conn, db) {
  const [[a]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${db}\`.ref_attorney`);
  const [[s]] = await conn.query(
    `SELECT COUNT(*) AS n FROM \`${db}\`.ref_attorney WHERE id_state IS NOT NULL`
  );
  const [[linked]] = await conn.query(
    `SELECT COUNT(*) AS n FROM \`${db}\`.lead_legal WHERE id_attorney IS NOT NULL`
  );
  console.log(`\n  ref_attorney: ${a.n} (${s.n} con id_state)`);
  console.log(`  lead_legal con id_attorney: ${linked.n}`);
}

async function main() {
  const db = config.target.database;
  console.log(`Normalizar ref_attorney en ${db}…\n`);

  await withTarget(async (conn) => {
    await upgradeAttorneyColumns(conn, db);
    await upgradeStatusToIsActive(conn, db);
    await ensureIdStateColumn(conn, db);
    await syncFromProd(conn, db);
    await dropAttorneyStateTable(conn, db);
    try {
      await applyFlatView(conn);
    } catch (e) {
      console.log(`  ⚠ vista flat: ${e.message}`);
    }
    await report(conn, db);
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
