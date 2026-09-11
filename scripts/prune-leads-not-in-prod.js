#!/usr/bin/env node
/**
 * Borra de TNFG_INTAKE lo que ya no está en dbProduction.tblLeads:
 *   · tblLeads_src (staging)
 *   · lead + grafo (party, org, notes, …)
 *
 * No remigra. Para recargar contenido: remigrate:updated --from-prod o reload:full --full-copy.
 *
 * Uso:
 *   npm run prune:leads-orphans -- --dry-run
 *   npm run prune:leads-orphans
 *   npm run prune:leads-orphans -- --force   # si prod bajó de 80% vs INTAKE
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const config = require('../src/config');
const { withTarget, sourcePool, closeAll } = require('../src/db');
const { pruneLeadsNotInProd } = require('../src/migration/pruneOrphans');

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
    skipSrc: argv.includes('--skip-src'),
    skipLead: argv.includes('--skip-lead'),
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!config.hasSeparateSource) {
    console.log('prune:leads-orphans — skip (MIG_SOURCE no está separado de destino)');
    return;
  }

  console.log('prune:leads-orphans — INTAKE IDs que no están en prod.tblLeads');
  console.log(`  Prod:    ${config.source.host}/${config.source.database}.tblLeads`);
  console.log(`  Destino: ${config.target.host}/${config.target.database}`);
  console.log(`  Modo:    ${opts.dryRun ? 'dry-run' : 'LIVE'}\n`);

  await withTarget(async (targetConn) => {
    const sourceConn = await sourcePool.getConnection();
    try {
      const result = await pruneLeadsNotInProd(sourceConn, targetConn, {
        dryRun: opts.dryRun,
        force: opts.force,
        src: !opts.skipSrc,
        lead: !opts.skipLead,
      });

      console.log(`  prod.tblLeads:     ${result.prodCount}`);
      console.log(`  huérfanos src:     ${result.srcOrphans.length}`);
      console.log(`  huérfanos lead:    ${result.normOrphans.length}`);
      if (result.srcOrphans.length && result.srcOrphans.length <= 15) {
        console.log(`    src ids: ${result.srcOrphans.join(', ')}`);
      }
      if (opts.dryRun) {
        console.log('\n(dry-run) no se borró nada');
        return;
      }
      console.log(`  borrados src:      ${result.deletedSrc}`);
      console.log(`  borrados lead:     ${result.deletedNorm}`);
      console.log('\n✓ prune listo. Después: npm run sync -- --only tblLeads_mat  (datamart)');
    } finally {
      sourceConn.release();
    }
  });
}

main()
  .catch((e) => {
    console.error('\nError:', e.message || e);
    process.exitCode = 1;
  })
  .finally(() => closeAll());
