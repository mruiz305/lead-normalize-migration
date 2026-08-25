#!/usr/bin/env node
/**
 * Exporta tblLeadsLogsStatusRules, tblLeadsStatusCatalog y refStates_cnv
 * desde dbProduction → sql/seeds/seed_business_rules_from_prod.sql
 *
 * Requiere .env en tnfg-datamart-etl (SRC_DB_*) o variables equivalentes:
 *   SRC_DB_HOST, SRC_DB_USER, SRC_DB_PASSWORD, SRC_DB_DATABASE
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dmEnv = path.join(__dirname, '../../tnfg-datamart-etl/.env');
if (fs.existsSync(dmEnv)) require('dotenv').config({ path: dmEnv });
else require('dotenv').config();

function esc(s) {
  if (s == null || s === '') return 'NULL';
  return `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.SRC_DB_HOST,
    port: Number(process.env.SRC_DB_PORT || 3306),
    user: process.env.SRC_DB_USER,
    password: process.env.SRC_DB_PASSWORD,
    database: process.env.SRC_DB_DATABASE || 'dbProduction',
  });

  const out = [
    '-- Seed business rules from dbProduction',
    '-- npm run seed:export-business-rules',
    'SET NAMES utf8mb4;',
    '',
  ];

  const [rules] = await conn.query(`
    SELECT Id, TAG, TXLocationAlias, VisitsAlias, LDOTAlias, AccidentStateAlias,
           LegalStatus, ClinicalStatus, RESULT, active
    FROM tblLeadsLogsStatusRules ORDER BY Id
  `);
  const resultMap = { ACTIVE: 1, DROPPED: 2, 'REF OUT': 3 };
  for (const r of rules) {
    const idLog = resultMap[r.RESULT];
    if (!idLog) continue;
    const active = Buffer.isBuffer(r.active) ? r.active[0] : (r.active?.data?.[0] ?? 1);
    out.push(`INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (${esc(r.TAG?.trim() || null)}, ${esc(r.TXLocationAlias)}, ${esc(r.VisitsAlias)}, ${esc(r.LDOTAlias)}, ${esc(r.AccidentStateAlias)}, ${esc(r.LegalStatus)}, ${esc(r.ClinicalStatus)}, ${idLog}, ${r.Id}, ${active});`);
  }

  out.push('');
  const [catalog] = await conn.query('SELECT * FROM tblLeadsStatusCatalog ORDER BY Id');
  for (const c of catalog) {
    out.push(`INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES (${esc(c.statusTypeId)}, ${esc(c.value)}, ${esc(c.description || c.value)}, ${c.Id});`);
  }

  out.push('');
  const [statesCnv] = await conn.query(`
    SELECT s.State, sc.cnv
    FROM refStates_cnv sc
    INNER JOIN refStates s ON sc.idState = s.idState
    WHERE sc.active = 1 ORDER BY s.State
  `);
  for (const row of statesCnv) {
    const cnv = Number(row.cnv).toFixed(2);
    out.push(`INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, ${cnv}, 1 FROM ref_state WHERE state_name = ${esc(row.State)} LIMIT 1;`);
  }

  out.push('');
  out.push('-- SpecialList → ref_special_list');
  const [special] = await conn.query(`SELECT ID, STATUS FROM SpecialList WHERE ID <> '' GROUP BY ID, STATUS`);
  for (const row of special) {
    const status = row.STATUS === 'DROPPED' ? 'DROPPED' : 'ACTIVE';
    out.push(`INSERT IGNORE INTO ref_special_list (lead_key, status_code, legacy_id)
VALUES (${esc(String(row.ID).trim())}, ${esc(status)}, ${esc(String(row.ID).trim())});`);
  }

  out.push('');
  out.push('-- Abogados excluidos regla CONFIRMED (por nombre → id_attorney en TNFG)');
  try {
    const [exclude] = await conn.query('SELECT TRIM(attorney) AS attorney FROM vw_refattorneys_exclude_confirmed_rule');
    for (const row of exclude) {
      out.push(`INSERT IGNORE INTO ref_attorney_cnv_exclude (id_attorney, reason)
SELECT id_attorney, 'exclude confirmed rule' FROM ref_attorney WHERE display_name = ${esc(row.attorney)} LIMIT 1;`);
    }
  } catch {
    out.push('-- vw_refattorneys_exclude_confirmed_rule no disponible');
  }

  const seedPath = path.join(root, 'sql/seeds/seed_business_rules_from_prod.sql');
  fs.mkdirSync(path.dirname(seedPath), { recursive: true });
  fs.writeFileSync(seedPath, `${out.join('\n')}\n`);
  console.log(`✓ ${seedPath}`);
  console.log(`  rules: ${rules.length}, catalog: ${catalog.length}, states_cnv: ${statesCnv.length}, special: ${special.length}`);
  await conn.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
