#!/usr/bin/env node
/**
 * Agrega columnas extra de g_users en app_user (idempotente).
 * El sync:users también las asegura antes del upsert.
 *
 *   npm run patch:app-user-g-users-extras
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const config = require('../src/config');
const { withTarget, closeAll } = require('../src/db');
const { ensureAppUserExtraColumns } = require('../src/migration/appUserExtras');

async function main() {
  console.log(`patch:app-user-g-users-extras → ${config.target.host}/${config.target.database}`);
  await withTarget(async (conn) => {
    const { added, altered } = await ensureAppUserExtraColumns(conn);
    if (!added.length && !altered.length) {
      console.log('  · columnas ya existían');
      return;
    }
    if (added.length) console.log(`  ✓ agregadas: ${added.join(', ')}`);
    if (altered.length) console.log(`  ✓ tipo ajustado: ${altered.join(', ')}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => closeAll());
