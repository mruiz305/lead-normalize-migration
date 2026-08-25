#!/usr/bin/env node
/** Aplica sql/patches/add_lead_business_rules.sql + seed opcional */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function runSqlFile(conn, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  await conn.query(sql);
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.TNFG_DB_HOST || process.env.MIG_TARGET_HOST || process.env.DB_HOST,
    port: Number(process.env.TNFG_DB_PORT || process.env.MIG_TARGET_PORT || process.env.DB_PORT || 3306),
    user: process.env.TNFG_DB_USER || process.env.MIG_TARGET_USER || process.env.DB_USER,
    password: process.env.TNFG_DB_PASSWORD ?? process.env.MIG_TARGET_PASSWORD ?? process.env.DB_PASSWORD ?? '',
    database: process.env.TNFG_DB_DATABASE || process.env.MIG_TARGET_DATABASE || process.env.DB_DATABASE || 'TNFG_INTAKE',
    multipleStatements: true,
  });

  const root = path.join(__dirname, '..');
  console.log('Applying patch add_lead_business_rules…');
  await runSqlFile(conn, path.join(root, 'sql/patches/add_lead_business_rules.sql'));

  console.log('Applying patch add_special_list_and_cnv_groups…');
  await runSqlFile(conn, path.join(root, 'sql/patches/add_special_list_and_cnv_groups.sql'));

  console.log('Applying patch add_log_rule_dimensions…');
  await runSqlFile(conn, path.join(root, 'sql/patches/add_log_rule_dimensions.sql'));

  const overrideSeed = path.join(root, 'sql/seeds/seed_log_status_override_rules.sql');
  if (fs.existsSync(overrideSeed)) {
    console.log('Applying seed_log_status_override_rules…');
    await runSqlFile(conn, overrideSeed);
  }

  const cnvRulesPath = path.join(root, 'sql/seeds/seed_cnv_rules_by_id.sql');
  if (fs.existsSync(cnvRulesPath)) {
    console.log('Applying seed_cnv_rules_by_id…');
    await runSqlFile(conn, cnvRulesPath);
  }

  const seedPath = path.join(root, 'sql/seeds/seed_business_rules_from_prod.sql');
  if (process.argv.includes('--seed') && fs.existsSync(seedPath)) {
    console.log('Applying seed_business_rules_from_prod…');
    await runSqlFile(conn, seedPath);
  }

  const migrateIdsPath = path.join(root, 'sql/seeds/migrate_log_rules_to_dim_ids.sql');
  if (fs.existsSync(migrateIdsPath)) {
    console.log('Applying migrate_log_rules_to_dim_ids…');
    await runSqlFile(conn, migrateIdsPath);
  }

  const specialListSeed = path.join(root, 'sql/seeds/seed_special_list_from_prod.sql');
  if (fs.existsSync(specialListSeed)) {
    console.log('Applying seed_special_list_from_prod…');
    await runSqlFile(conn, specialListSeed);
  }

  await conn.end();
  console.log('✓ Done');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
