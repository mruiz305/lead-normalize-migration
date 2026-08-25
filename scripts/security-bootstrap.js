#!/usr/bin/env node
/** Crea tablas SECURITY_TNFG (tenant, persona, sistema, rol…). */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { withSecurity, closeAll } = require('../src/db');

async function main() {
  const db = config.security?.database || 'SECURITY_TNFG';
  console.log(`Bootstrap SECURITY → ${db} @ ${config.security?.host}\n`);

  const sqlPath = path.join(config.sqlDir, 'security', '01_bootstrap_security.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  await withSecurity(async (conn) => {
    await conn.query(sql);
    const tables = [
      'tenant', 'sistema', 'persona', 'persona_sistema_origen',
      'rol', 'permiso', 'rol_permiso', 'persona_rol', 'persona_acceso_recurso',
    ];
    for (const t of tables) {
      const [[{ n }]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${db}\`.\`${t}\``);
      console.log(`  ✓ ${t}: ${n} filas`);
    }
  });

  await closeAll();
  console.log('\nListo. Ver docs/SECURITY_TNFG_MODELO.md');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
