#!/usr/bin/env node
/**
 * Crea ref_sub_office + app_user.id_sub_office, siembra catálogo desde prod,
 * y deja listo sync:users / apply-views.
 *
 *   npm run patch:ref-sub-office
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, withSource, closeAll } = require('../src/db');
const config = require('../src/config');
const { ensureSubOfficeCatalogFromGUsers } = require('../src/migration/subOfficeCatalog');

async function tableExists(conn, db, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
    [db, table]
  );
  return rows.length > 0;
}

async function columnExists(conn, db, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [db, table, column]
  );
  return rows.length > 0;
}

async function main() {
  const db = config.target.database;
  console.log(`ref_sub_office en ${db}…\n`);

  await withTarget(async (targetConn) => {
    if (!(await tableExists(targetConn, db, 'ref_sub_office'))) {
      const sql = fs.readFileSync(
        path.join(config.sqlDir, 'patches', 'add_ref_sub_office.sql'),
        'utf8'
      );
      await targetConn.query(sql);
      console.log('  ✓ tabla ref_sub_office');
    } else {
      console.log('  · tabla ref_sub_office ya existe');
    }

    if (!(await columnExists(targetConn, db, 'app_user', 'id_sub_office'))) {
      await targetConn.query(`
        ALTER TABLE \`${db}\`.app_user
          ADD COLUMN id_sub_office int DEFAULT NULL
            COMMENT 'g_users.SubOffice → FK ref_sub_office'
            AFTER id_company_office,
          ADD KEY idx_app_user_sub_office (id_sub_office),
          ADD CONSTRAINT fk_app_user_sub_office
            FOREIGN KEY (id_sub_office) REFERENCES ref_sub_office (id_sub_office)
      `);
      console.log('  ✓ app_user.id_sub_office + FK');
    } else {
      console.log('  · app_user.id_sub_office ya existe');
    }

    await withSource(async (sourceConn) => {
      const stats = await ensureSubOfficeCatalogFromGUsers(sourceConn, targetConn);
      console.log(
        `  ✓ catálogo: ${stats.sourceDistinct} distintos en prod, +${stats.inserted} nuevos`
      );
    });

    const [[{ c }]] = await targetConn.query(
      `SELECT COUNT(*) AS c FROM \`${db}\`.ref_sub_office`
    );
    console.log(`  total ref_sub_office: ${c}`);
  });

  await closeAll();
  console.log('\nListo. Siguiente: npm run sync:users && npm run apply-views');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
