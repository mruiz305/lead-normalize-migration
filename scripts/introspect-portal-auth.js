#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function main() {
  const db = process.env.SRC_ALT_DB_DATABASE;
  const conn = await mysql.createConnection({
    host: process.env.SRC_ALT_DB_HOST,
    port: Number(process.env.SRC_ALT_DB_PORT || 3306),
    user: process.env.SRC_ALT_DB_USER,
    password: process.env.SRC_ALT_DB_PASSWORD,
    database: db,
    connectTimeout: 20000,
  });

  const [tables] = await conn.query(
    'SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY 1',
    [db]
  );
  const names = tables.map((r) => r.t);
  console.log('database:', db, '| tables:', names.length);

  const userLike = names.filter((n) =>
    /user|auth|role|perm|access|action|grant|login|account|credential|session|menu|privilege/i.test(n)
  );
  console.log('\n=== user/auth/permission tables ===');
  console.log(userLike.join('\n') || '(none)');

  for (const t of userLike) {
    const [cols] = await conn.query(
      `SELECT COLUMN_NAME AS c, COLUMN_TYPE AS ty, COLUMN_KEY AS k, COLUMN_COMMENT AS cm
       FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [db, t]
    );
    console.log(`\n--- ${t} ---`);
    for (const col of cols) {
      console.log([col.c, col.ty, col.k || '', col.cm || ''].join('\t'));
    }
    const [[cnt]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${db}\`.\`${t}\``);
    console.log(`rows: ${cnt.n}`);
  }

  if (userLike.length) {
    const ph = userLike.map(() => '?').join(',');
    const [fks] = await conn.query(
      `SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL
         AND (TABLE_NAME IN (${ph}) OR REFERENCED_TABLE_NAME IN (${ph}))`,
      [db, ...userLike, ...userLike]
    );
    console.log('\n=== FKs ===');
    for (const f of fks) {
      console.log(`${f.TABLE_NAME}.${f.COLUMN_NAME} -> ${f.REFERENCED_TABLE_NAME}.${f.REFERENCED_COLUMN_NAME}`);
    }
  }

  // sample permission rows if common patterns exist
  for (const t of ['users', 'user', 'User', 'permissions', 'permission', 'roles', 'role', 'actions', 'action']) {
    if (!names.includes(t)) continue;
    const [sample] = await conn.query(`SELECT * FROM \`${db}\`.\`${t}\` LIMIT 3`);
    console.log(`\n=== sample ${t} ===`);
    console.log(JSON.stringify(sample, null, 2));
  }

  await conn.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
