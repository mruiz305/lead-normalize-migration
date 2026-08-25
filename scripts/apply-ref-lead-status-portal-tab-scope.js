#!/usr/bin/env node
/** refLeadStatus.portal_tab_scope — qué tabs del portal muestran cada status. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

const ALTER_SQL = `
ALTER TABLE refLeadStatus
  ADD COLUMN portal_tab_scope enum('hidden','case_manager','active_leads','both')
    NOT NULL DEFAULT 'hidden'
    COMMENT 'Portal Case Manager / Active Leads tabs — hidden = no mostrar'
    AFTER leadOrder
`;

async function main() {
  const db = config.target.database;
  console.log(`refLeadStatus.portal_tab_scope en ${db}…\n`);

  await withTarget(async (conn) => {
    try {
      await conn.query(ALTER_SQL);
      console.log('  ✓ columna portal_tab_scope creada');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
      console.log('  · columna portal_tab_scope ya existe');
    }

    const sql = fs.readFileSync(
      path.join(config.sqlDir, 'patches', 'ref_lead_status_portal_tab_scope.sql'),
      'utf8',
    );
    await conn.query(sql);

    const [rows] = await conn.query(
      `SELECT leadStatus, portal_tab_scope
       FROM refLeadStatus
       WHERE portal_tab_scope <> 'hidden'
       ORDER BY COALESCE(leadOrder, 999), leadStatus`,
    );
    console.log('  ✓ visibles en portal:');
    for (const row of rows) {
      console.log(`    - ${row.leadStatus}: ${row.portal_tab_scope}`);
    }
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
