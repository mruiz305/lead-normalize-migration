#!/usr/bin/env node
/** Seed permisos + roles INTAKE en SECURITY_TNFG. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { withSecurity, closeAll } = require('../src/db');

async function main() {
  const db = config.security?.database || 'SECURITY_TNFG';
  console.log(`Seed RBAC INTAKE → ${db}\n`);

  const sqlPath = path.join(config.sqlDir, 'security', '03_seed_intake_rbac.sql');
  await withSecurity(async (conn) => {
    await conn.query(fs.readFileSync(sqlPath, 'utf8'));
    const [[{ idIntake }]] = await conn.query(
      `SELECT id_sistema AS idIntake FROM \`${db}\`.sistema WHERE system_code='INTAKE'`
    );
    for (const t of ['permiso', 'rol', 'rol_permiso']) {
      const [[{ n }]] = await conn.query(
        t === 'permiso' || t === 'rol'
          ? `SELECT COUNT(*) AS n FROM \`${db}\`.\`${t}\` WHERE id_sistema = ?`
          : `SELECT COUNT(*) AS n FROM \`${db}\`.rol_permiso rp
             JOIN \`${db}\`.rol r ON r.id_rol = rp.id_rol WHERE r.id_sistema = ?`,
        [idIntake]
      );
      console.log(`  ✓ ${t} (INTAKE): ${n}`);
    }
  });

  await closeAll();
  console.log('\nListo. Ver docs/SECURITY_INTAKE_PERMISOS.md');
  console.log('Siguiente: npm run security:assign:intake-roles');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
