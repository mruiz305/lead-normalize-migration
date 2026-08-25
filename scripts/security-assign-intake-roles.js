#!/usr/bin/env node
/** persona_rol intake desde app_user.access_level legacy. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { assignIntakeRoles } = require('../src/security/assignIntakeRoles');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`Asignar roles INTAKE a staff${dryRun ? ' (dry-run)' : ''}…\n`);

  const stats = await assignIntakeRoles({ dryRun });
  console.log(`  persona_rol INTAKE: ${stats.assigned}`);
  console.log(`  omitidos (sin id_persona/rol): ${stats.skipped}`);
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
