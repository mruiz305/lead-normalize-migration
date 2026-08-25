#!/usr/bin/env node
/** lead_party: lead_insurance.id_lead_party, lead_party_injury_site, id_personal_severity; drop varchar legacy. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');
const {
  linkLeadInsuranceToParty,
  relinkLeadPartyInjurySites,
  backfillPartyPersonalSeverityFromInjuries,
  dropLegacyPartyColumns,
} = require('../src/migration/partyCatalog');

async function main() {
  const db = config.target.database;
  console.log(`Normalización lead_party en ${db}…\n`);

  await withTarget(async (targetConn) => {
    const baseSql = fs.readFileSync(
      path.join(config.sqlDir, 'patches', 'party_normalize.sql'),
      'utf8'
    );
    await targetConn.query(baseSql);
    console.log('  ✓ lead_party_injury_site + id_personal_severity');

    const linked = await linkLeadInsuranceToParty(targetConn);
    console.log(`  ✓ lead_insurance.id_lead_party: ${linked} filas enlazadas`);

    const sites = await relinkLeadPartyInjurySites(targetConn);
    console.log(`  ✓ lead_party_injury_site backfill: ${sites} filas`);

    const sevFixed = await backfillPartyPersonalSeverityFromInjuries(targetConn);
    console.log(`  ✓ id_personal_severity desde injuries: ${sevFixed} copasajeros`);

    const dropped = await dropLegacyPartyColumns(targetConn);
    console.log(`  ✓ columnas legacy eliminadas: ${dropped}`);

    const viewSql = fs.readFileSync(
      path.join(config.sqlDir, '03_view_tblLeads_flat.sql'),
      'utf8'
    );
    await targetConn.query(viewSql);
    console.log('  ✓ vista v_tblLeads_flat');
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
