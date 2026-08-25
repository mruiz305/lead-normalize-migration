#!/usr/bin/env node
/** refAttorneys → ref_law_firm + ref_attorney_profile + state + alias; lead_legal FK. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');
const { loadStateMap } = require('../src/migration/state');
const {
  syncAttorneyCatalog,
  migrateLegacyRefAttorneys,
  loadAttorneyProfileMap,
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

async function ensureSchema(conn, db) {
  if (await tableExists(conn, db, 'ref_attorney_profile')) {
    console.log('  · tablas abogado ya existen');
    return;
  }
  const sql = fs.readFileSync(
    path.join(config.sqlDir, 'patches', 'normalize_attorney_catalog.sql'),
    'utf8'
  );
  await conn.query(sql);
  console.log('  ✓ ref_law_firm, ref_attorney_profile, ref_attorney_state, ref_attorney_alias');
}

async function migrateLeadLegal(conn, db) {
  const [fkOld] = await conn.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'lead_legal' AND CONSTRAINT_NAME = 'fk_lead_legal_attorney'`,
    [db]
  );
  if (fkOld.length) {
    await conn.query(`ALTER TABLE \`${db}\`.lead_legal DROP FOREIGN KEY fk_lead_legal_attorney`);
  }

  const hasOld = await columnExists(conn, db, 'lead_legal', 'id_attorney');
  const hasNew = await columnExists(conn, db, 'lead_legal', 'id_attorney_profile');

  if (hasOld && !hasNew) {
    await conn.query(`
      ALTER TABLE \`${db}\`.lead_legal
        CHANGE COLUMN id_attorney id_attorney_profile int DEFAULT NULL
    `);
    console.log('  ✓ lead_legal.id_attorney → id_attorney_profile');
  }

  if (!(await columnExists(conn, db, 'lead_legal', 'id_prev_attorney_profile'))) {
    await conn.query(`
      ALTER TABLE \`${db}\`.lead_legal
        ADD COLUMN id_prev_attorney_profile int DEFAULT NULL AFTER has_prev_attorney
    `);
    console.log('  ✓ lead_legal + id_prev_attorney_profile');
  }

  const attorneyMaps = await loadAttorneyProfileMap(conn);
  const [prevRows] = await conn.query(`
    SELECT id_lead, prev_attorney_name FROM \`${db}\`.lead_legal
    WHERE prev_attorney_name IS NOT NULL AND TRIM(prev_attorney_name) <> ''
      AND id_prev_attorney_profile IS NULL
  `);
  let prevUpdated = 0;
  for (const r of prevRows) {
    const id = attorneyMaps.resolveAttorneyProfileId(r.prev_attorney_name);
    if (!id) continue;
    await conn.query(
      `UPDATE \`${db}\`.lead_legal SET id_prev_attorney_profile = ? WHERE id_lead = ?`,
      [id, r.id_lead]
    );
    prevUpdated += 1;
  }
  if (prevUpdated) console.log(`  ✓ backfill id_prev_attorney_profile: ${prevUpdated}`);

  for (const [fkName, col] of [
    ['fk_lead_legal_profile', 'id_attorney_profile'],
    ['fk_lead_legal_prev_profile', 'id_prev_attorney_profile'],
  ]) {
    const [exists] = await conn.query(
      `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'lead_legal' AND CONSTRAINT_NAME = ? LIMIT 1`,
      [db, fkName]
    );
    if (exists.length) continue;
    await conn.query(`
      ALTER TABLE \`${db}\`.lead_legal
        ADD CONSTRAINT ${fkName} FOREIGN KEY (${col})
          REFERENCES \`${db}\`.ref_attorney_profile (id_attorney_profile)
    `);
  }

  if (await tableExists(conn, db, 'refAttorneys')) {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query(`DROP TABLE \`${db}\`.refAttorneys`);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('  ✓ drop refAttorneys');
  }
  console.log('  ✓ lead_legal FK → ref_attorney_profile');
}

async function reResolveAttorneys(conn, db) {
  const maps = await loadAttorneyProfileMap(conn);
  const [rejects] = await conn.query(`
    SELECT id_reject, id_lead, raw_value FROM \`${db}\`.import_reject
    WHERE field_name = 'attorney' AND reject_reason = 'catalog_miss'
  `);
  let fixed = 0;
  for (const r of rejects) {
    const id = maps.resolveAttorneyProfileId(r.raw_value);
    if (!id) continue;
    await conn.query(
      `UPDATE \`${db}\`.lead_legal SET id_attorney_profile = ? WHERE id_lead = ? AND id_attorney_profile IS NULL`,
      [id, r.id_lead]
    );
    fixed += 1;
  }
  if (fixed) console.log(`  ✓ re-resolve attorney desde import_reject: ${fixed}`);
}

async function applyFlatView(conn) {
  const sql = fs.readFileSync(path.join(config.sqlDir, '03_view_tblLeads_flat.sql'), 'utf8');
  await conn.query(sql);
  console.log('  ✓ vista v_tblLeads_flat');
}

async function main() {
  const db = config.target.database;
  console.log(`Normalizar catálogo abogados en ${db}…\n`);

  await withTarget(async (conn) => {
    await ensureSchema(conn, db);
    const stateMap = await loadStateMap(conn);

    let stats;
    if (await tableExists(conn, db, 'refAttorneys')) {
      stats = await migrateLegacyRefAttorneys(conn, stateMap.stateByName);
      console.log(
        `  ✓ migrado refAttorneys → ${stats.profiles} perfiles, ${stats.firms} firms, ` +
          `${stats.states} state links, ${stats.aliases} aliases`
      );
    } else {
      const [[{ n }]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${db}\`.ref_attorney_profile`);
      if (Number(n) === 0 && config.hasSeparateSource) {
        const { withSource } = require('../src/db');
        await withSource(async (sourceConn) => {
          stats = await syncAttorneyCatalog(sourceConn, conn, { stateByName: stateMap.stateByName });
        });
        console.log(`  ✓ sync prod → ${stats.profiles} perfiles`);
      } else {
        console.log(`  · ref_attorney_profile: ${n} filas`);
      }
    }

    await migrateLeadLegal(conn, db);
    await reResolveAttorneys(conn, db);
    try {
      await applyFlatView(conn);
    } catch (e) {
      console.log(`  ⚠ vista flat: ${e.message}`);
    }
  });

  await closeAll();
  console.log('\nListo. Catálogo abogado normalizado.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
