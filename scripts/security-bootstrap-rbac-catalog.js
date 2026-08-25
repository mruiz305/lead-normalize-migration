#!/usr/bin/env node
/** Aplica catálogo Vista × Acción + seed intake. Idempotente. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { withSecurity, closeAll } = require('../src/db');

async function runSql(conn, db, file) {
  const sql = fs.readFileSync(path.join(config.sqlDir, 'security', file), 'utf8');
  await conn.query(sql);
}

async function main() {
  const db = config.security?.database || 'SECURITY_TNFG';
  console.log(`RBAC Vista×Acción → ${db}\n`);

  await withSecurity(async (conn) => {
    await runSql(conn, db, '04_rbac_vista_accion.sql');
    await runSql(conn, db, '05_seed_intake_vista_accion.sql');

    const [[{ acciones }]] = await conn.query(`SELECT COUNT(*) AS acciones FROM \`${db}\`.accion`);
    const [[{ vistas }]] = await conn.query(
      `SELECT COUNT(*) AS vistas FROM \`${db}\`.vista v
       JOIN \`${db}\`.sistema s ON s.id_sistema = v.id_sistema AND s.system_code = 'INTAKE'`
    );
    const [[{ rva }]] = await conn.query(
      `SELECT COUNT(*) AS rva FROM \`${db}\`.rol_vista_accion rva
       JOIN \`${db}\`.rol r ON r.id_rol = rva.id_rol
       JOIN \`${db}\`.sistema s ON s.id_sistema = r.id_sistema AND s.system_code = 'INTAKE'`
    );
    console.log(`  ✓ accion: ${acciones}`);
    console.log(`  ✓ vista (INTAKE): ${vistas}`);
    console.log(`  ✓ rol_vista_accion (INTAKE): ${rva}`);
  });

  await closeAll();
  console.log('\nListo. Ver docs/SECURITY_RBAC_CATALOGO.md');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
