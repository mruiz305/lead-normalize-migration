#!/usr/bin/env node
/**
 * Migration: set app_user.id_company_office from g_users.office + ref_company_office.
 * Run after append:missing-offices (or copy-catalogs) so new office codes get users.
 *
 *   npm run backfill:app-user-office
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { withTarget, withSource, closeAll } = require('../src/db');
const { backfillAppUserOfficeFromGUsers } = require('../src/migration/officeCatalog');

async function main() {
  await withTarget(async (targetConn) => {
    await withSource(async (sourceConn) => {
      const stats = await backfillAppUserOfficeFromGUsers(sourceConn, targetConn);
      console.log(
        `✓ app_user.id_company_office: ${stats.updated} filas actualizadas (${stats.mappedEmails} emails con oficina en catálogo)`,
      );
    });
  });
  await closeAll();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
