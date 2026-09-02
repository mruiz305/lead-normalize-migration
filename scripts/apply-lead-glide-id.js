#!/usr/bin/env node
/**
 * Añade lead.glide_id (UNIQUE NULL) y backfill glide_id = id_lead
 * para el histórico migrado desde Glide.
 *
 *   npm run patch:lead-glide-id
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

async function main() {
  const db = config.target.database;
  console.log(`lead.glide_id en ${db}…\n`);

  await withTarget(async (conn) => {
    const [[col]] = await conn.query(
      `SELECT COUNT(*) AS c
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'lead' AND COLUMN_NAME = 'glide_id'`,
      [db]
    );
    if (Number(col.c) === 0) {
      const sql = fs.readFileSync(
        path.join(config.sqlDir, 'patches', 'add_lead_glide_id.sql'),
        'utf8'
      );
      await conn.query(sql);
      console.log('  ✓ columna + UNIQUE uk_lead_glide_id');
      // Primera vez: histórico migrado tiene id_lead = idLead Glide.
      const [upd] = await conn.query(
        `UPDATE \`${db}\`.\`lead\`
         SET glide_id = id_lead
         WHERE glide_id IS NULL`
      );
      console.log(`  ✓ backfill histórico glide_id = id_lead: ${upd.affectedRows} filas`);
    } else {
      console.log('  · columna ya existe');
      // Re-run seguro: solo filas que aún coinciden con staging (no inventar glide en solo-portal).
      const srcTable = process.env.MIG_SOURCE_LEADS_TABLE || 'tblLeads_src';
      const [upd] = await conn.query(
        `UPDATE \`${db}\`.\`lead\` l
         INNER JOIN \`${db}\`.\`${srcTable}\` s ON s.idLead = l.id_lead
         SET l.glide_id = l.id_lead
         WHERE l.glide_id IS NULL`
      );
      console.log(`  ✓ backfill residual (via ${srcTable}): ${upd.affectedRows} filas`);
    }
    const [[{ total, withGlide, onlyPortal }]] = await conn.query(
      `SELECT
         COUNT(*) AS total,
         SUM(glide_id IS NOT NULL) AS withGlide,
         SUM(glide_id IS NULL) AS onlyPortal
       FROM \`${db}\`.\`lead\``
    );
    console.log(`  total=${total} con_glide_id=${withGlide} solo_portal=${onlyPortal}`);
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
