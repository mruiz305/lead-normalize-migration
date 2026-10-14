#!/usr/bin/env node
/**
 * Espejo dbProduction.SpecialList → TNFG_INTAKE.ref_special_list (upsert + borra lo que prod quitó).
 * Uso: node scripts/sync-special-list.js [--dry-run]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { withTarget, withSource, closeAll } = require('../src/db');
const { syncSpecialList } = require('../src/migration/specialListSync');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`sync ref_special_list ← prod.SpecialList${dryRun ? ' (dry-run)' : ''}`);
  await withSource(async (sourceConn) => {
    await withTarget(async (targetConn) => {
      const s = await syncSpecialList(sourceConn, targetConn, { dryRun });
      console.log(
        `  prod: ${s.prod} · antes: ${s.before} · nuevas: ${s.inserted} · cambiadas: ${s.updated} · borradas: ${s.deleted}` +
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
