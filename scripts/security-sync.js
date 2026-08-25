#!/usr/bin/env node
/**
 * Sync SECURITY_TNFG:
 *   - Portal: identity_service_dev (solo lectura)
 *   - Intake staff: TNFG_INTAKE.app_user (NO g_users)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const config = require('../src/config');
const { runSecuritySync } = require('../src/security/securitySync');

async function main() {
  const truncate = process.argv.includes('--truncate');
  console.log('Sync SECURITY_TNFG…');
  console.log(`  destino:  ${config.security.database} @ ${config.security.host}`);
  console.log(`  portal:   ${config.identity?.database} @ ${config.identity?.host} (solo lectura)`);
  console.log(`  intake:   ${config.target.database}.app_user @ ${config.target.host}`);
  if (truncate) console.log('  modo:     TRUNCATE datos sync previos\n');
  else console.log('');

  const stats = await runSecuritySync({ truncate });

  console.log('Portal (identity):');
  console.log(`  roles: ${stats.portal.roles}, permisos: ${stats.portal.permissions}`);
  console.log(`  personas externas: ${stats.portal.personas}`);
  console.log(`  persona_rol: ${stats.portal.persona_rol}, accesos recurso: ${stats.portal.accesos}`);

  console.log('\nIntake (app_user migrado):');
  console.log(`  app_user leídos: ${stats.intake.app_users}`);
  console.log(`  enlazados a persona: ${stats.intake.personas_linked}`);
  console.log(`  email ya existía (portal+staff): ${stats.intake.email_already_in_portal}`);

  console.log('\nTotales SECURITY_TNFG:');
  for (const [t, n] of Object.entries(stats.totals)) {
    console.log(`  ${t}: ${n}`);
  }
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
