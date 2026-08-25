#!/usr/bin/env node
/** Auditoría en tablas hijas de lead (las que aún no la tienen). npm run patch:lead-domain-audit */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');
const { applyLeadDomainAudit } = require('../src/migration/leadAudit');

async function main() {
  const db = config.target.database;
  console.log(`Auditoría dominio lead en ${db}…\n`);

  await withTarget(async (conn) => {
    await applyLeadDomainAudit(conn);
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
