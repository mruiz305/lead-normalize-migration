#!/usr/bin/env node
/**
 * Migration helper (local/dev): remove COR * clinic offices from ref_company_office.
 * Prefer this over hand-written SQL. Idempotent.
 *
 *   npm run purge:cor-offices
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { withTarget, closeAll } = require('../src/db');
const { purgeCorOfficesFromCatalog } = require('../src/migration/officeCatalog');

async function main() {
  await withTarget(async (targetConn) => {
    const stats = await purgeCorOfficesFromCatalog(targetConn);
    if (!stats.removed) {
      console.log('Nada que borrar — no hay oficinas COR % en el catálogo.');
      return;
    }
    console.log(`✓ Removidas ${stats.removed} oficinas COR:`);
    for (const code of stats.codes) console.log(`  - ${code}`);
    console.log('FKs limpiadas:', stats.cleared);
  });
  await closeAll();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
