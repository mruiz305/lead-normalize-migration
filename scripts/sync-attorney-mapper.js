#!/usr/bin/env node
/**
 * Espejo dbProduction.refAttorneys_portal_mapper → TNFG_INTAKE.ref_attorney_portal_mapper.
 * Crea la tabla si no existe. Uso: node scripts/sync-attorney-mapper.js [--dry-run]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { withTarget, withSource, closeAll } = require('../src/db');
const { syncAttorneyPortalMapper } = require('../src/migration/attorneyPortalMapperSync');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`sync ref_attorney_portal_mapper ← prod.refAttorneys_portal_mapper${dryRun ? ' (dry-run)' : ''}`);
  await withSource(async (sourceConn) => {
    await withTarget(async (targetConn) => {
      const s = await syncAttorneyPortalMapper(sourceConn, targetConn, { dryRun });
      console.log(
        `  prod: ${s.prod} · antes: ${s.before} · nuevas o cambiadas: ${s.upserted} · borradas: ${s.deleted}` +
          (s.deletesSkipped ? ` · ⚠ ${s.deletesSkipped} borrados omitidos (tope de seguridad)` : '')
      );
      if (dryRun) console.log('  (dry-run) no se escribió nada');
    });
  });
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
  })
  .finally(() => closeAll());
