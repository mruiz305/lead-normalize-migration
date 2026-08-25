#!/usr/bin/env node
/** Seed roles portal bridge para pantallas intake (sin case-service). */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { withSecurity, closeAll } = require('../src/db');

async function main() {
  const db = config.security?.database || 'SECURITY_TNFG';
  console.log(`Seed portal ↔ intake bridge → ${db}\n`);

  const sqlPath = path.join(config.sqlDir, 'security', '08_seed_portal_intake_bridge.sql');
  await withSecurity(async (conn) => {
    await conn.query(fs.readFileSync(sqlPath, 'utf8'));
    const [[{ idPortal }]] = await conn.query(
      `SELECT id_sistema AS idPortal FROM \`${db}\`.sistema WHERE system_code='PORTAL_ABOGADOS'`
    );
    for (const code of [
      'portal_intake_staff',
      'portal_intake_user_admin',
      'portal_intake_admin',
    ]) {
      const [[row]] = await conn.query(
        `SELECT COUNT(*) AS n FROM \`${db}\`.rol_permiso rp
         JOIN \`${db}\`.rol r ON r.id_rol = rp.id_rol
         WHERE r.id_sistema = ? AND r.role_code = ?`,
        [idPortal, code]
      );
      console.log(`  ✓ ${code}: ${row.n} permisos`);
    }
  });

  await closeAll();
  console.log('\nListo. Siguiente: npm run security:assign:intake-roles');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
