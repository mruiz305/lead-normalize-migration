#!/usr/bin/env node
/** Aplica 11_seed_representatives_home_views.sql en SECURITY_TNFG. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { withSecurity, closeAll } = require('../src/db');

async function main() {
  const db = config.security?.database || 'SECURITY_TNFG';
  console.log(`Seed vistas Home/Directory/perfil → ${db}\n`);

  const sqlPath = path.join(
    config.sqlDir,
    'security',
    '11_seed_representatives_home_views.sql',
  );
  await withSecurity(async (conn) => {
    await conn.query(fs.readFileSync(sqlPath, 'utf8'));
    const [rows] = await conn.query(
      `SELECT v.view_code, v.display_name, v.sort_order
       FROM \`${db}\`.ui_views v
       JOIN \`${db}\`.applications s ON s.id = v.application_id
       WHERE s.system_code IN ('REPRESENTATIVES', 'INTAKE')
         AND v.view_code IN (
           'directory_1800','schedule_call_back','my_profile','request',
           'lead_sheets','lead_sheets_v2','general_lead_sheets','logs_v2',
           'regional_rosters','performance_roster_daily','edit_profile','account_settings'
         )
       ORDER BY v.sort_order`,
    );
    for (const v of rows) {
      console.log(
        `  ${String(v.sort_order).padStart(3)}  ${v.view_code.padEnd(28)} ${v.display_name}`,
      );
    }
  });

  await closeAll();
  console.log('\nListo. Refresca Permissions en Security Admin (Application: Representatives).');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
