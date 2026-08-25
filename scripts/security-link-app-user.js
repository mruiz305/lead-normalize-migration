#!/usr/bin/env node
/** Backfill app_user.id_persona desde SECURITY persona_sistema_origen. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { linkAppUserPersona } = require('../src/security/linkAppUserPersona');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`Enlace app_user.id_persona ← SECURITY${dryRun ? ' (dry-run)' : ''}…\n`);

  const stats = await linkAppUserPersona({ dryRun });
  console.log(`  orígenes INTAKE_APP_USER: ${stats.origins}`);
  console.log(`  filas actualizadas: ${stats.linked}`);
  console.log(`  app_user con id_persona: ${stats.totalWithPersona}`);
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
