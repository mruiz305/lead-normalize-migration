#!/usr/bin/env node
/** Colapsa ref_law_firm + ref_attorney_profile + alias + state → ref_attorney (1:1 prod). */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll, withSource } = require('../src/db');
const config = require('../src/config');
const { loadStateMap } = require('../src/migration/state');
const {
  syncAttorneyCatalog,
  migrateLegacyRefAttorneys,
  loadAttorneyMap,
} = require('../src/migration/attorneyCatalog');

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

async function dropFkIfExists(conn, db, table, fkName) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY' LIMIT 1`,
    [db, table, fkName]
  );
  if (rows.length) {
    await conn.query(`ALTER TABLE \`${db}\`.\`${table}\` DROP FOREIGN KEY \`${fkName}\``);
  }
}

async function ensureRefAttorney(conn, db) {
  if (await tableExists(conn, db, 'ref_attorney')) {
    console.log('  · ref_attorney ya existe');
    return;
  }
  const sql = fs.readFileSync(
    path.join(config.sqlDir, 'patches', 'simplify_attorney_catalog.sql'),
    'utf8'
  );
  await conn.query(sql);
  console.log('  ✓ ref_attorney creada');
}

async function syncFromProd(conn, db) {
  const stateMap = await loadStateMap(conn);
  let stats;
  if (await tableExists(conn, db, 'refAttorneys')) {
    stats = await migrateLegacyRefAttorneys(conn, stateMap);
    console.log(`  ✓ refAttorneys legacy → ref_attorney: ${stats.attorneys} (${stats.withState} con id_state)`);
    return stats;
  }
  if (config.hasSeparateSource) {
    await withSource(async (sourceConn) => {
      stats = await syncAttorneyCatalog(sourceConn, conn, stateMap);
    });
    console.log(`  ✓ sync prod → ref_attorney: ${stats.attorneys} (${stats.withState} con id_state)`);
    return stats;
  }
  const [[{ n }]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${db}\`.ref_attorney`);
  console.log(`  · ref_attorney: ${n} filas (sin origen separado)`);
  return { attorneys: Number(n) };
}

async function migrateLeadLegalColumns(conn, db) {
  const hasProfile = await columnExists(conn, db, 'lead_legal', 'id_attorney_profile');
  const hasAttorney = await columnExists(conn, db, 'lead_legal', 'id_attorney');

  for (const fk of [
    'fk_lead_legal_profile', 'fk_lead_legal_prev_profile',
    'fk_lead_legal_attorney', 'fk_lead_legal_prev_attorney',
  ]) {
    await dropFkIfExists(conn, db, 'lead_legal', fk);
  }

  if (hasProfile && !hasAttorney) {
    await conn.query(`
      ALTER TABLE \`${db}\`.lead_legal
        CHANGE COLUMN id_attorney_profile id_attorney int DEFAULT NULL,
        CHANGE COLUMN id_prev_attorney_profile id_prev_attorney int DEFAULT NULL
    `);
    console.log('  ✓ lead_legal: id_attorney_profile → id_attorney');
  } else if (!hasAttorney) {
    await conn.query(`
      ALTER TABLE \`${db}\`.lead_legal
        ADD COLUMN id_attorney int DEFAULT NULL AFTER id_lead,
        ADD COLUMN id_prev_attorney int DEFAULT NULL AFTER has_prev_attorney
    `);
    console.log('  ✓ lead_legal + id_attorney, id_prev_attorney');
  }

  for (const [fk, col] of [
    ['fk_lead_legal_attorney', 'id_attorney'],
    ['fk_lead_legal_prev_attorney', 'id_prev_attorney'],
  ]) {
    const [exists] = await conn.query(
      `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'lead_legal' AND CONSTRAINT_NAME = ? LIMIT 1`,
      [db, fk]
    );
    if (exists.length) continue;
    await conn.query(`
      ALTER TABLE \`${db}\`.lead_legal
        ADD CONSTRAINT \`${fk}\` FOREIGN KEY (\`${col}\`)
          REFERENCES \`${db}\`.ref_attorney (id_attorney)
    `);
  }
  console.log('  ✓ lead_legal FK → ref_attorney');
}

async function dropLegacyAttorneyTables(conn, db) {
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of ['ref_attorney_alias', 'ref_attorney_state', 'ref_attorney_profile', 'ref_law_firm', 'refAttorneys']) {
    if (await tableExists(conn, db, t)) {
      await conn.query(`DROP TABLE \`${db}\`.\`${t}\``);
      console.log(`  ✓ drop ${t}`);
    }
  }
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function reResolveAttorneys(conn, db) {
  const maps = await loadAttorneyMap(conn);
  const [rejects] = await conn.query(`
    SELECT id_lead, raw_value FROM \`${db}\`.import_reject
    WHERE field_name = 'attorney' AND reject_reason = 'catalog_miss'
  `);
  let fixed = 0;
  for (const r of rejects) {
    const id = maps.resolveAttorneyId(r.raw_value);
    if (!id) continue;
    await conn.query(
      `UPDATE \`${db}\`.lead_legal SET id_attorney = ? WHERE id_lead = ? AND id_attorney IS NULL`,
      [id, r.id_lead]
    );
    fixed += 1;
  }
  if (fixed) console.log(`  ✓ re-resolve attorney: ${fixed}`);
}

async function applyFlatView(conn) {
  const sql = fs.readFileSync(path.join(config.sqlDir, '03_view_tblLeads_flat.sql'), 'utf8');
  await conn.query(sql);
  console.log('  ✓ vista v_tblLeads_flat');
}

async function report(conn, db) {
  const [[a]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${db}\`.ref_attorney`);
  const [[linked]] = await conn.query(
    `SELECT COUNT(*) AS n FROM \`${db}\`.lead_legal WHERE id_attorney IS NOT NULL`
  );
  const [[states]] = await conn.query(
    `SELECT COUNT(*) AS n FROM \`${db}\`.ref_attorney WHERE states IS NOT NULL AND TRIM(states) <> ''`
  );
  console.log(`\n  ref_attorney: ${a.n} (${states.n} con states)`);
  console.log(`  lead_legal con id_attorney: ${linked.n}`);
}

async function main() {
  const db = config.target.database;
  console.log(`Simplificar catálogo abogados en ${db}…\n`);

  await withTarget(async (conn) => {
    await ensureRefAttorney(conn, db);
    await syncFromProd(conn, db);
    await migrateLeadLegalColumns(conn, db);
    await reResolveAttorneys(conn, db);
    await dropLegacyAttorneyTables(conn, db);
    try {
      await applyFlatView(conn);
    } catch (e) {
      console.log(`  ⚠ vista flat: ${e.message}`);
    }
    await report(conn, db);
  });

  await closeAll();
  console.log('\nListo. ref_attorney 1:1 prod; tablas legacy eliminadas.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
