#!/usr/bin/env node
/** Importa SpecialList desde dbProduction → ref_special_list en TNFG */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env') });
const dmEnv = path.join(__dirname, '../../tnfg-datamart-etl/.env');
if (fs.existsSync(dmEnv)) require('dotenv').config({ path: dmEnv });

function esc(s) {
  if (s == null || s === '') return 'NULL';
  return `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

async function main() {
  const src = await mysql.createConnection({
    host: process.env.SRC_DB_HOST || process.env.MIG_SOURCE_HOST,
    port: Number(process.env.SRC_DB_PORT || process.env.MIG_SOURCE_PORT || 3306),
    user: process.env.SRC_DB_USER || process.env.MIG_SOURCE_USER,
    password: process.env.SRC_DB_PASSWORD ?? process.env.MIG_SOURCE_PASSWORD ?? '',
    database: process.env.SRC_DB_DATABASE || process.env.MIG_SOURCE_DATABASE || 'dbProduction',
  });

  const tgt = await mysql.createConnection({
    host: process.env.TNFG_DB_HOST || process.env.MIG_TARGET_HOST,
    port: Number(process.env.TNFG_DB_PORT || process.env.MIG_TARGET_PORT || 3306),
    user: process.env.TNFG_DB_USER || process.env.MIG_TARGET_USER,
    password: process.env.TNFG_DB_PASSWORD ?? process.env.MIG_TARGET_PASSWORD ?? '',
    database: process.env.TNFG_DB_DATABASE || process.env.MIG_TARGET_DATABASE || 'TNFG_INTAKE',
    multipleStatements: true,
  });

  const [rows] = await src.query(
    `SELECT ID, STATUS FROM SpecialList WHERE ID <> '' GROUP BY ID, STATUS`
  );

  const lines = [
    '-- SpecialList desde dbProduction',
    'SET NAMES utf8mb4;',
    '',
  ];

  for (const row of rows) {
    const key = String(row.ID).trim();
    const status = row.STATUS === 'DROPPED' ? 'DROPPED' : 'ACTIVE';
    lines.push(
      `INSERT INTO ref_special_list (lead_key, status_code, legacy_id, is_active)
VALUES (${esc(key)}, ${esc(status)}, ${esc(key)}, 1)
ON DUPLICATE KEY UPDATE status_code = VALUES(status_code), legacy_id = VALUES(legacy_id), is_active = 1;`
    );
  }

  const seedPath = path.join(root, 'sql/seeds/seed_special_list_from_prod.sql');
  fs.writeFileSync(seedPath, `${lines.join('\n')}\n`);
  console.log(`✓ Wrote ${seedPath} (${rows.length} rows)`);

  await tgt.query(lines.slice(2).join('\n'));
  const [[{ n }]] = await tgt.query('SELECT COUNT(*) AS n FROM ref_special_list');
  console.log(`✓ TNFG ref_special_list: ${n} entries`);

  await src.end();
  await tgt.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
