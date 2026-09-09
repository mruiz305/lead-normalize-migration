#!/usr/bin/env node
/**
 * Unique app_user.legacy_row_id (Glide rowId) + nick / referred_by.
 * Quita unique por email. Idempotente.
 *
 *   npm run patch:app-user-rowid-key
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');
const { ensureAppUserRowIdKey } = require('../src/migration/appUserRowIdKey');

async function main() {
  console.log(`app_user llave rowId en ${config.target.database}…\n`);

  await withTarget(async (targetConn) => {
    const { changes } = await ensureAppUserRowIdKey(targetConn);
    if (changes.length) {
      for (const c of changes) console.log(`  ✓ ${c}`);
    } else {
      console.log('  · schema ya alineado (uk_app_user_legacy_row_id, sin unique email)');
    }
  });

  await closeAll();
  console.log('\nListo. Siguiente: npm run sync:users');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
