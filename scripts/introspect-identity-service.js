#!/usr/bin/env node
const mysql = require('mysql2/promise');

const DB = process.env.SRC_ALT_DB_DATABASE || 'identity_service_dev';

async function describe(conn, db, table) {
  const [cols] = await conn.query(
    `SELECT COLUMN_NAME c, COLUMN_TYPE ty, IS_NULLABLE n, COLUMN_KEY k, COLUMN_COMMENT cm
     FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION`,
    [db, table]
  );
  const [[{ cnt }]] = await conn.query(`SELECT COUNT(*) AS cnt FROM \`${db}\`.\`${table}\``);
  console.log(`\n--- ${table} (${cnt} rows) ---`);
  for (const col of cols) {
    console.log(`  ${col.c}\t${col.ty}${col.k ? `\t[${col.k}]` : ''}${col.cm ? `\t// ${col.cm}` : ''}`);
  }
}

async function sample(conn, db, table, limit = 5) {
  const [rows] = await conn.query(`SELECT * FROM \`${db}\`.\`${table}\` LIMIT ${limit}`);
  console.log(`\n=== sample ${table} ===`);
  console.log(JSON.stringify(rows, null, 2));
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.SRC_ALT_DB_HOST,
    port: Number(process.env.SRC_ALT_DB_PORT || 3306),
    user: process.env.SRC_ALT_DB_USER,
    password: process.env.SRC_ALT_DB_PASSWORD,
    database: DB,
  });

  const core = [
    'applications',
    'users',
    'roles',
    'permissions',
    'role_permissions',
    'user_roles',
    'user_resource_access',
    'tenants',
    'external_clients',
  ];

  for (const t of core) await describe(conn, DB, t);

  for (const t of ['applications', 'roles', 'permissions']) await sample(conn, DB, t, 10);

  const [permByApp] = await conn.query(`
    SELECT a.code AS app_code, a.name AS app_name, COUNT(DISTINCT p.id) AS perm_count
    FROM applications a
    LEFT JOIN permissions p ON p.application_id = a.id
    GROUP BY a.id, a.code, a.name
    ORDER BY a.code
  `);
  console.log('\n=== permissions per application ===');
  console.table(permByApp);

  const [rolesByApp] = await conn.query(`
    SELECT a.code AS app_code, COUNT(DISTINCT r.id) AS role_count
    FROM applications a
    LEFT JOIN roles r ON r.application_id = a.id
    GROUP BY a.id, a.code
  `);
  console.log('\n=== roles per application ===');
  console.table(rolesByApp);

  await conn.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
