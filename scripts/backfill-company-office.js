#!/usr/bin/env node
/** Backfill lead.id_company_office y lead_org_snapshot.id_company_office desde office_code / catálogo. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

async function main() {
  await withTarget(async (conn) => {
    const db = config.target.database;

    const [[{ leadNull }]] = await conn.query(
      `SELECT COUNT(*) AS leadNull FROM \`${db}\`.\`lead\` WHERE id_company_office IS NULL`
    );
    const [[{ snapNull }]] = await conn.query(
      `SELECT COUNT(*) AS snapNull FROM \`${db}\`.lead_org_snapshot
       WHERE id_company_office IS NULL AND office_code IS NOT NULL AND TRIM(office_code) <> ''`
    );
    console.log(`Pendientes: lead.id_company_office NULL=${leadNull}, snapshot con office_code sin FK=${snapNull}\n`);

    const [leadResult] = await conn.query(`
      UPDATE \`${db}\`.\`lead\` l
      INNER JOIN \`${db}\`.lead_org_snapshot s ON s.id_lead = l.id_lead
      INNER JOIN \`${db}\`.ref_company_office o
        ON UPPER(TRIM(o.office_code)) = UPPER(TRIM(s.office_code)) AND o.is_active = 1
      SET l.id_company_office = o.id_company_office
      WHERE l.id_company_office IS NULL AND s.office_code IS NOT NULL
    `);
    console.log(`  ✓ lead.id_company_office: ${leadResult.affectedRows} filas actualizadas`);

    const [snapResult] = await conn.query(`
      UPDATE \`${db}\`.lead_org_snapshot s
      INNER JOIN \`${db}\`.ref_company_office o
        ON UPPER(TRIM(o.office_code)) = UPPER(TRIM(s.office_code)) AND o.is_active = 1
      SET s.id_company_office = o.id_company_office
      WHERE s.id_company_office IS NULL AND s.office_code IS NOT NULL
    `);
    console.log(`  ✓ lead_org_snapshot.id_company_office: ${snapResult.affectedRows} filas actualizadas`);

    const [[{ leadStill }]] = await conn.query(
      `SELECT COUNT(*) AS leadStill FROM \`${db}\`.\`lead\` WHERE id_company_office IS NULL`
    );
    const [[{ unmapped }]] = await conn.query(
      `SELECT COUNT(DISTINCT s.office_code) AS unmapped
       FROM \`${db}\`.lead_org_snapshot s
       LEFT JOIN \`${db}\`.ref_company_office o
         ON UPPER(TRIM(o.office_code)) = UPPER(TRIM(s.office_code)) AND o.is_active = 1
       WHERE s.office_code IS NOT NULL AND TRIM(s.office_code) <> '' AND o.id_company_office IS NULL`
    );
    console.log(`\nRestantes lead sin id_company_office: ${leadStill}`);
    console.log(`Códigos office sin catálogo (distinct): ${unmapped}`);
  });
  await closeAll();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
