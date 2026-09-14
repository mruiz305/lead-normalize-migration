#!/usr/bin/env node
/**
 * Añade hierarchy_membership.origin (GLIDE | PORTAL, default PORTAL) y marca
 * como GLIDE todo lo que hay hoy.
 *
 * El backfill es seguro en bloque porque hasta este patch la tabla era 100%
 * derivada: sync:users la truncaba y la rehacía entera desde g_users cada 3
 * minutos, así que nada cargado a mano podía estar vivo al momento de correr
 * esto. Después del patch esa equivalencia ya no vale, y por eso el backfill
 * corre una única vez, al crear la columna.
 *
 *   npm run patch:hierarchy-origin
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

async function main() {
  const db = config.target.database;
  console.log(`hierarchy_membership.origin en ${db}…\n`);

  await withTarget(async (conn) => {
    const [[col]] = await conn.query(
      `SELECT COUNT(*) AS c
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'hierarchy_membership'
         AND COLUMN_NAME = 'origin'`,
      [db]
    );

    if (Number(col.c) === 0) {
      const sql = fs.readFileSync(
        path.join(config.sqlDir, 'patches', 'add_hierarchy_membership_origin.sql'),
        'utf8'
      );
      await conn.query(sql);
      console.log('  ✓ columna + idx_hierarchy_membership_origin');

      const [upd] = await conn.query(
        `UPDATE \`${db}\`.hierarchy_membership SET origin = 'GLIDE'`
      );
      console.log(`  ✓ backfill origin = GLIDE: ${upd.affectedRows} filas`);
    } else {
      console.log('  · columna ya existe');
      console.log('  · sin backfill (ya puede haber filas del portal que no hay que pisar)');
    }

    const [[{ glide, portal }]] = await conn.query(
      `SELECT SUM(origin = 'GLIDE') AS glide, SUM(origin = 'PORTAL') AS portal
       FROM \`${db}\`.hierarchy_membership`
    );
    console.log(`  glide=${glide} portal=${portal}`);
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
