#!/usr/bin/env node
/**
 * Espeja en el modelo las tablas de Glide que el tablero necesita y que no se
 * pueden derivar de lo migrado.
 *
 *   lead_status_log             ← tblLeadsLogsStatus
 *     ACTIVE | DROPPED | REF OUT | PROBLEM. REF OUT no es un leadStatus: un
 *     lead referido a un abogado sigue figurando "Came In".
 *
 *   lead_legal_clinical_status  ← tblLeadsDataLegalClinicalStatus
 *     El estado legal vigente y el convertedValue. Contradice a
 *     tblLeads.legalStatus dentro de Glide, y el tablero lee este.
 *
 * Uso: node scripts/sync-glide-mirrors.js [--full] [--dry-run] [--only <tabla>]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { withTarget, withSource, closeAll } = require('../src/db');
const { mirrorGlideTable } = require('../src/migration/glideMirror');
const { SPEC: STATUS_LOG } = require('../src/migration/leadStatusLog');
const { SPEC: LEGAL_CLINICAL } = require('../src/migration/leadLegalClinicalStatus');

const MIRRORS = [
  { spec: STATUS_LOG, patch: 'add_lead_status_log.sql' },
  { spec: LEGAL_CLINICAL, patch: 'add_lead_legal_clinical_status.sql' },
];

async function ensureSchema(conn, db, table, patch) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
    [db, table]
  );
  if (rows.length) return;
  const sql = fs.readFileSync(path.join(config.sqlDir, 'patches', patch), 'utf8');
  await conn.query(sql);
  console.log(`  ✓ ${table} creada`);
}

async function main() {
  const full = process.argv.includes('--full');
  const dryRun = process.argv.includes('--dry-run');
  const onlyIdx = process.argv.indexOf('--only');
  const only = onlyIdx >= 0 ? process.argv[onlyIdx + 1] : null;

  const db = config.target.database;
  const src = config.source.database;
  const targets = only ? MIRRORS.filter((m) => m.spec.table === only) : MIRRORS;
  if (!targets.length) throw new Error(`--only ${only}: no hay espejo con ese nombre`);

  console.log(`espejos Glide → ${db}${full ? ' (full)' : ''}${dryRun ? ' (dry-run)' : ''}\n`);

  await withTarget(async (targetConn) => {
    await withSource(async (sourceConn) => {
      for (const { spec, patch } of targets) {
        console.log(`${spec.table} ← ${src}.${spec.sourceTable}`);
        if (!dryRun) await ensureSchema(targetConn, db, spec.table, patch);

        const [[prod]] = await sourceConn.query(
          `SELECT COUNT(*) AS n, MAX(row_changed_at) AS ult FROM \`${src}\`.${spec.sourceTable}`
        );
        console.log(`  prod:  ${prod.n} filas (último cambio ${prod.ult ?? '—'})`);

        if (dryRun) {
          console.log('  (dry-run) no se escribió nada\n');
          continue;
        }

        const stats = await mirrorGlideTable(sourceConn, targetConn, spec, { full });
        console.log(
          `  leídas ${stats.read} · escritas ${stats.written}` +
            (stats.sinLead ? ` · ${stats.sinLead} sin lead local` : '')
        );

        const [[after]] = await targetConn.query(
          `SELECT COUNT(*) AS n, COUNT(DISTINCT id_lead) AS leads FROM \`${db}\`.${spec.table}`
        );
        console.log(`  ✓ ${after.n} filas / ${after.leads} leads\n`);
      }
    });
  });
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
  })
  .finally(() => closeAll());
