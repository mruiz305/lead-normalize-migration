#!/usr/bin/env node
/** refTXLocations → ref_tx_location (display_name + tx_group, id_state FK). */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll, withSource } = require('../src/db');
const config = require('../src/config');
const { loadStateMap } = require('../src/migration/state');
const {
  syncTxLocationCatalog,
  migrateLegacyRefTXLocations,
  loadTxLocationMap,
} = require('../src/migration/txLocationCatalog');

async function tableExists(conn, db, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
    [db, table]
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

async function dropFkIfExists(conn, db, table, fkName) {
  if (await fkExists(conn, db, table, fkName)) {
    await conn.query(`ALTER TABLE \`${db}\`.\`${table}\` DROP FOREIGN KEY \`${fkName}\``);
  }
}

async function ensureRefTxLocation(conn, db) {
  if (await tableExists(conn, db, 'ref_tx_location')) {
    console.log('  · ref_tx_location ya existe');
    return;
  }
  const sql = fs.readFileSync(
    path.join(config.sqlDir, 'patches', 'normalize_tx_location.sql'),
    'utf8'
  );
  await conn.query(sql);
  console.log('  ✓ ref_tx_location creada');
}

async function syncFromProd(conn, db) {
  const stateMap = await loadStateMap(conn);
  let stats;
  if (await tableExists(conn, db, 'refTXLocations')) {
    stats = await migrateLegacyRefTXLocations(conn, stateMap);
    console.log(`  ✓ refTXLocations legacy → ${stats.locations} filas (${stats.withState} con id_state)`);
    return stats;
  }
  if (config.hasSeparateSource) {
    await withSource(async (sourceConn) => {
      stats = await syncTxLocationCatalog(sourceConn, conn, stateMap);
    });
  } else {
    stats = await syncTxLocationCatalog(conn, conn, stateMap);
  }
  console.log(`  ✓ sync prod → ${stats.locations} TX (${stats.withState} con id_state)`);
  return stats;
}

async function rewireForeignKeys(conn, db) {
  for (const [table, oldFk, newFk] of [
    ['lead_clinical', 'fk_lead_clinical_tx', 'fk_lead_clinical_tx_loc'],
    ['lead_party', 'fk_lead_party_tx', 'fk_lead_party_tx_loc'],
  ]) {
    await dropFkIfExists(conn, db, table, oldFk);
    await dropFkIfExists(conn, db, table, newFk);
    if (!(await fkExists(conn, db, table, newFk))) {
      await conn.query(`
        ALTER TABLE \`${db}\`.\`${table}\`
          ADD CONSTRAINT \`${newFk}\` FOREIGN KEY (id_tx_location)
            REFERENCES \`${db}\`.ref_tx_location (id_tx_location)
      `);
    }
  }
  console.log('  ✓ lead_clinical / lead_party FK → ref_tx_location');
}

async function dropLegacyTable(conn, db) {
  if (!(await tableExists(conn, db, 'refTXLocations'))) return;
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  await conn.query(`DROP TABLE \`${db}\`.refTXLocations`);
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('  ✓ drop refTXLocations');
}

async function reResolveTxLocations(conn, db) {
  const maps = await loadTxLocationMap(conn);
  const [rejects] = await conn.query(`
    SELECT id_lead, raw_value FROM \`${db}\`.import_reject
    WHERE field_name = 'tx_location' AND reject_reason = 'catalog_miss'
  `);
  let fixed = 0;
  for (const r of rejects) {
    const id = maps.resolveTxLocationId(r.raw_value);
    if (!id) continue;
    await conn.query(
      `UPDATE \`${db}\`.lead_clinical SET id_tx_location = ? WHERE id_lead = ? AND id_tx_location IS NULL`,
      [id, r.id_lead]
    );
    fixed += 1;
  }
  if (fixed) console.log(`  ✓ re-resolve tx_location: ${fixed}`);
}

async function applyFlatView(conn) {
  const sql = fs.readFileSync(path.join(config.sqlDir, '03_view_tblLeads_flat.sql'), 'utf8');
  await conn.query(sql);
  console.log('  ✓ vista v_tblLeads_flat');
}

async function report(conn, db) {
  const [[n]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${db}\`.ref_tx_location`);
  const [[s]] = await conn.query(
    `SELECT COUNT(*) AS n FROM \`${db}\`.ref_tx_location WHERE id_state IS NOT NULL`
  );
  const [[linked]] = await conn.query(
    `SELECT COUNT(*) AS n FROM \`${db}\`.lead_clinical WHERE id_tx_location IS NOT NULL`
  );
  console.log(`\n  ref_tx_location: ${n.n} (${s.n} con id_state)`);
  console.log(`  lead_clinical con id_tx_location: ${linked.n}`);
}

async function main() {
  const db = config.target.database;
  console.log(`Normalizar TX locations en ${db}…\n`);

  await withTarget(async (conn) => {
    await ensureRefTxLocation(conn, db);
    await syncFromProd(conn, db);
    await rewireForeignKeys(conn, db);
    await reResolveTxLocations(conn, db);
    await dropLegacyTable(conn, db);
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
