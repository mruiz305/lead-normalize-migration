#!/usr/bin/env node
/**
 * Idempotent: add ref_company_office rows for g_users.office codes missing from catalog.
 * Does NOT truncate. Safe to run on an already-migrated TNFG_INTAKE (local/dev).
 *
 *   node scripts/append-missing-offices-from-g-users.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { withTarget, withSource, closeAll } = require('../src/db');
const { appendMissingOfficesFromGUsers } = require('../src/migration/officeCatalog');

async function main() {
  await withTarget(async (targetConn) => {
    await withSource(async (sourceConn) => {
      const stats = await appendMissingOfficesFromGUsers(sourceConn, targetConn);
      if (!stats.added) {
        console.log('Nada que agregar — catálogo ya cubre g_users.office activos.');
        return;
      }
      console.log(`✓ Agregadas ${stats.added} oficinas:`);
      for (const code of stats.codes) console.log(`  - ${code}`);
      console.log('\nLuego (opcional): node scripts/backfill-company-office.js');
    });
  });
  await closeAll();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
