#!/usr/bin/env node
/** Patch: columna app_user.id_persona en TNFG_INTAKE. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { withTarget, closeAll } = require('../src/db');

async function main() {
  const db = config.target.database;
  console.log(`Patch app_user.id_persona → ${db}\n`);

  const sqlPath = path.join(config.sqlDir, 'patches', 'app_user_id_persona.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  await withTarget(async (conn) => {
    await conn.query(sql);
    const [[{ hasCol }]] = await conn.query(
      `SELECT COUNT(*) AS hasCol FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'app_user' AND COLUMN_NAME = 'id_persona'`,
      [db]
    );
    console.log(hasCol ? '  ✓ app_user.id_persona presente' : '  ✗ columna no creada');
  });

  await closeAll();
  console.log('\nListo. Ejecutá: npm run security:link-app-user');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
