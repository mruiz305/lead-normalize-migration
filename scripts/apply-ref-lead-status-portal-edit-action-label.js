#!/usr/bin/env node
/** refLeadStatus.portal_edit_action_label — botones Edit Lead (Pending / Drop / CNA). */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

const ALTER_LABEL_SQL = `
ALTER TABLE refLeadStatus
  ADD COLUMN portal_edit_action_label varchar(50) DEFAULT NULL
    COMMENT 'Portal Edit Lead quick action button label; NULL = no button'
    AFTER portal_tab_scope
`;

const ALTER_ORDER_SQL = `
ALTER TABLE refLeadStatus
  ADD COLUMN portal_edit_action_order int DEFAULT NULL
    COMMENT 'Portal Edit Lead button sort order; independent from leadOrder (tabs)'
    AFTER portal_edit_action_label
`;

async function main() {
  const db = config.target.database;
  console.log(`refLeadStatus portal Edit Lead actions en ${db}…\n`);

  await withTarget(async (conn) => {
    try {
      await conn.query(ALTER_LABEL_SQL);
      console.log('  ✓ columna portal_edit_action_label creada');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
      console.log('  · columna portal_edit_action_label ya existe');
    }

    try {
      await conn.query(ALTER_ORDER_SQL);
      console.log('  ✓ columna portal_edit_action_order creada');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
      console.log('  · columna portal_edit_action_order ya existe');
    }

    const sql = fs.readFileSync(
      path.join(
        config.sqlDir,
        'patches',
        'ref_lead_status_portal_edit_action_label.sql',
      ),
      'utf8',
    );
    await conn.query(sql);

    const [rows] = await conn.query(
      `SELECT leadStatus, portal_edit_action_label, portal_edit_action_order
       FROM refLeadStatus
       WHERE portal_edit_action_label IS NOT NULL
         AND TRIM(portal_edit_action_label) <> ''
       ORDER BY COALESCE(portal_edit_action_order, 999), leadStatus`,
    );
    console.log('  ✓ acciones Edit Lead (orden propio, no leadOrder):');
    for (const row of rows) {
      console.log(
        `    - [${row.portal_edit_action_order}] ${row.leadStatus} → botón "${row.portal_edit_action_label}"`,
      );
    }
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
