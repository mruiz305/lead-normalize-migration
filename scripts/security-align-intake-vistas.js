#!/usr/bin/env node
/** Aplica 09_align_intake_vistas_ui.sql — catálogo vistas INTAKE = pantallas reales. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { withSecurity, closeAll } = require('../src/db');

async function main() {
  const db = config.security?.database || 'SECURITY_TNFG';
  console.log(`Alinear vistas INTAKE (UI) → ${db}\n`);

  const sqlPath = path.join(config.sqlDir, 'security', '09_align_intake_vistas_ui.sql');
  await withSecurity(async (conn) => {
    await conn.query(fs.readFileSync(sqlPath, 'utf8'));
    const [rows] = await conn.query(
      `SELECT vista_code, display_name, sort_order
       FROM \`${db}\`.vista
       WHERE id_sistema = (SELECT id_sistema FROM \`${db}\`.sistema WHERE system_code='INTAKE')
       ORDER BY sort_order`
    );
    for (const v of rows) {
      console.log(`  ${String(v.sort_order).padStart(3)}  ${v.vista_code.padEnd(20)} ${v.display_name}`);
    }
  });

  await closeAll();
  console.log('\nListo. Refresca Permissions en Security Admin (Application: Intake).');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
