#!/usr/bin/env node
/** Seed vistas/permisos reglas de negocio en SECURITY_TNFG. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { withSecurity, closeAll } = require('../src/db');

async function main() {
  const db = config.security?.database || 'SECURITY_TNFG';
  console.log(`Seed business rules RBAC → ${db}\n`);

  const sqlPath = path.join(config.sqlDir, 'security', '06_seed_business_rules_rbac.sql');
  await withSecurity(async (conn) => {
    await conn.query(fs.readFileSync(sqlPath, 'utf8'));
    const [[{ n }]] = await conn.query(
      `SELECT COUNT(*) AS n FROM \`${db}\`.vista WHERE vista_code IN ('reglas_log','reglas_cnv','catalogo_estado')`
    );
    console.log(`  ✓ vistas reglas: ${n}`);
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
