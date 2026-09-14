#!/usr/bin/env node
/**
 * Añade lead.origin (GLIDE | PORTAL, default PORTAL), marca como GLIDE el
 * histórico migrado y deja el trigger que deriva el origen en cada INSERT.
 *
 * El backfill aprovecha que hoy glide_id todavía distingue el origen: solo la
 * migración escribe glide_id. En cuanto leads-sync-api empiece a espejar leads
 * del portal en prod y les devuelva su idLead, esa equivalencia se rompe — por
 * eso el backfill corre una única vez, al crear la columna.
 *
 * El trigger sí se reaplica siempre: es lo que mantiene el origen correcto aun
 * si algún proceso quedó en una versión que no conoce la columna.
 *
 *   npm run patch:lead-origin
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

async function main() {
  const db = config.target.database;
  console.log(`lead.origin en ${db}…\n`);

  await withTarget(async (conn) => {
    const [[col]] = await conn.query(
      `SELECT COUNT(*) AS c
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'lead' AND COLUMN_NAME = 'origin'`,
      [db]
    );

    if (Number(col.c) === 0) {
      const sql = fs.readFileSync(
        path.join(config.sqlDir, 'patches', 'add_lead_origin.sql'),
        'utf8'
      );
      await conn.query(sql);
      console.log('  ✓ columna + idx_lead_origin_glide');

      const [upd] = await conn.query(
        `UPDATE \`${db}\`.\`lead\`
         SET origin = 'GLIDE'
         WHERE glide_id IS NOT NULL`
      );
      console.log(`  ✓ backfill histórico origin = GLIDE: ${upd.affectedRows} filas`);
    } else {
      console.log('  · columna ya existe');
      console.log('  · sin backfill (glide_id ya no distingue el origen una vez activo el espejo)');
    }

    // Siempre: DROP IF EXISTS + CREATE, así que reaplicarlo es seguro.
    const triggerSql = fs.readFileSync(
      path.join(config.sqlDir, 'patches', 'add_lead_origin_trigger.sql'),
      'utf8'
    );
    await conn.query(triggerSql);
    console.log('  ✓ trigger lead_origin_bi (deriva origin desde glide_id en cada INSERT)');

    const [[{ glide, portal, portalLinked }]] = await conn.query(
      `SELECT
         SUM(origin = 'GLIDE') AS glide,
         SUM(origin = 'PORTAL') AS portal,
         SUM(origin = 'PORTAL' AND glide_id IS NOT NULL) AS portalLinked
       FROM \`${db}\`.\`lead\``
    );
    console.log(`  glide=${glide} portal=${portal} (de ellos ${portalLinked} ya espejados en prod)`);
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
