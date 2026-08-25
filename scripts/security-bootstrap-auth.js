#!/usr/bin/env node
/** Aplica capa auth futura en SECURITY_TNFG (02_auth_layer_future.sql). Idempotente. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { withSecurity, closeAll } = require('../src/db');

async function main() {
  const db = config.security?.database || 'SECURITY_TNFG';
  console.log(`Bootstrap auth layer → ${db} @ ${config.security?.host}\n`);

  const sqlPath = path.join(config.sqlDir, 'security', '02_auth_layer_future.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  await withSecurity(async (conn) => {
    await conn.query(sql);
    const tables = [
      'sistema_oauth_config',
      'persona_credencial',
      'persona_invitacion',
      'auth_sesion',
      'persona_provision_log',
    ];
    for (const t of tables) {
      const [[{ n }]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${db}\`.\`${t}\``);
      console.log(`  ✓ ${t}: ${n} filas`);
    }
  });

  await closeAll();
  console.log('\nListo. Ver docs/SECURITY_TNFG_VISION.md');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
