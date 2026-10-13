#!/usr/bin/env node
/**
 * Resync TNFG_INTAKE.ref_tx_location desde prod.refTXLocations (upsert + baja lógica).
 * Uso: node scripts/sync-ref-tx-location.js [--dry-run]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const config = require('../src/config');
const { withTarget, withSource, closeAll } = require('../src/db');
const { syncTxLocationCatalog } = require('../src/migration/txLocationCatalog');
const { loadStateMap } = require('../src/migration/state');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`sync ref_tx_location ← prod.refTXLocations${dryRun ? ' (dry-run)' : ''}\n`);

  await withSource(async (sourceConn) => {
    await withTarget(async (targetConn) => {
      const src = config.source.database;
      const tgt = config.target.database;
      const [[{ prodC, prodMax }]] = await sourceConn.query(
        `SELECT COUNT(*) AS prodC, MAX(idTXLocation) AS prodMax FROM \`${src}\`.refTXLocations`
      );
      const [[{ normC, normMax }]] = await targetConn.query(
        `SELECT COUNT(*) AS normC, MAX(id_tx_location) AS normMax FROM \`${tgt}\`.ref_tx_location`
      );
      console.log(`  prod: ${prodC} (max ${prodMax})`);
      console.log(`  norm: ${normC} (max ${normMax})`);

      if (dryRun) {
        console.log('\n(dry-run) no se escribió nada');
        return;
      }

      const stateMap = await loadStateMap(targetConn);
      const stats = await syncTxLocationCatalog(sourceConn, targetConn, stateMap);
      console.log(
        `\n✓ ref_tx_location: ${stats.locations} (${stats.withState} con id_state)` +
          (stats.deactivated ? ` · ${stats.deactivated} ya no están en prod → inactivos` : '')
      );
    });
  });
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
  })
  .finally(() => closeAll());
