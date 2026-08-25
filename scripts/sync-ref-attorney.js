#!/usr/bin/env node
/**
 * Resync TNFG_INTAKE.ref_attorney desde prod.refAttorneys (truncate + reload).
 * Uso: node scripts/sync-ref-attorney.js [--dry-run]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const config = require('../src/config');
const { withTarget, withSource, closeAll } = require('../src/db');
const { syncAttorneyCatalog } = require('../src/migration/attorneyCatalog');
const { loadStateMap } = require('../src/migration/state');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`sync ref_attorney ← prod.refAttorneys${dryRun ? ' (dry-run)' : ''}\n`);

  await withSource(async (sourceConn) => {
    await withTarget(async (targetConn) => {
      const src = config.source.database;
      const tgt = config.target.database;
      const [[{ prodC, prodMax }]] = await sourceConn.query(
        `SELECT COUNT(*) AS prodC, MAX(idAttorney) AS prodMax FROM \`${src}\`.refAttorneys`
      );
      const [[{ normC, normMax }]] = await targetConn.query(
        `SELECT COUNT(*) AS normC, MAX(id_attorney) AS normMax FROM \`${tgt}\`.ref_attorney`
      );
      console.log(`  prod: ${prodC} (max ${prodMax})`);
      console.log(`  norm: ${normC} (max ${normMax})`);

      if (dryRun) {
        console.log('\n(dry-run) no se escribió nada');
        return;
      }

      const stateMap = await loadStateMap(targetConn);
      const stats = await syncAttorneyCatalog(sourceConn, targetConn, stateMap);
      console.log(`\n✓ ref_attorney: ${stats.attorneys} (${stats.withState} con id_state)`);

      // spot-check known mismatches
      const [check] = await targetConn.query(
        `SELECT id_attorney, display_name FROM \`${tgt}\`.ref_attorney
         WHERE id_attorney IN (600, 722, 795, 797, 807)
         ORDER BY id_attorney`
      );
      console.log('  sample:', check);
    });
  });
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
  })
  .finally(() => closeAll());
