#!/usr/bin/env node
/**
 * Repara lead_legal.id_attorney cuando:
 *  - import_reject.attorney = catalog_miss, o
 *  - id_attorney IS NULL pero tblLeads_src.attorney matchea el catálogo
 *    (case-insensitive + normalización MTD/NS).
 *
 * Uso:
 *   node scripts/backfill-attorney-catalog-miss.js --dry-run
 *   node scripts/backfill-attorney-catalog-miss.js
 *   node scripts/backfill-attorney-catalog-miss.js --id 555528
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const config = require('../src/config');
const { withTarget, closeAll } = require('../src/db');
const { loadAttorneyMap } = require('../src/migration/attorneyCatalog');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const idIdx = process.argv.indexOf('--id');
  const onlyId = idIdx >= 0 ? Number(process.argv[idIdx + 1]) : null;

  console.log(`Backfill attorney miss / null${dryRun ? ' (dry-run)' : ''}`);
  if (onlyId) console.log(`  solo id_lead=${onlyId}`);

  await withTarget(async (conn) => {
    const db = config.target.database;
    const { resolveAttorneyId } = await loadAttorneyMap(conn);
    const DEST = process.env.MIG_SOURCE_LEADS_TABLE || 'tblLeads_src';

    // Candidatos: reject catalog_miss O legal null con attorney en staging
    let sql = `
      SELECT
        l.id_lead,
        ll.id_attorney AS current_id,
        COALESCE(NULLIF(TRIM(ir.raw_value), ''), NULLIF(TRIM(src.attorney), '')) AS raw_value,
        ir.id_reject
      FROM \`${db}\`.\`lead\` l
      LEFT JOIN \`${db}\`.lead_legal ll ON ll.id_lead = l.id_lead
      LEFT JOIN \`${db}\`.import_reject ir
        ON ir.id_lead = l.id_lead AND ir.field_name = 'attorney' AND ir.reject_reason = 'catalog_miss'
      LEFT JOIN \`${db}\`.\`${DEST}\` src ON src.idLead = l.id_lead
      WHERE (
          ir.id_reject IS NOT NULL
          OR (ll.id_attorney IS NULL AND src.attorney IS NOT NULL AND TRIM(src.attorney) <> '')
        )
    `;
    const params = [];
    if (onlyId) {
      sql += ' AND l.id_lead = ?';
      params.push(onlyId);
    }
    sql += ' ORDER BY l.id_lead';

    const [rows] = await conn.query(sql, params);
    console.log(`  candidatos: ${rows.length}`);

    let fixed = 0;
    let stillMiss = 0;
    let alreadySet = 0;
    const fixedSamples = [];

    for (const row of rows) {
      if (!row.raw_value) {
        stillMiss += 1;
        continue;
      }
      const resolved = resolveAttorneyId(row.raw_value);
      if (!resolved) {
        stillMiss += 1;
        continue;
      }

      if (row.current_id != null && Number(row.current_id) === Number(resolved)) {
        alreadySet += 1;
        if (!dryRun && row.id_reject) {
          await conn.query(
            `DELETE FROM \`${db}\`.import_reject WHERE id_reject = ?`,
            [row.id_reject]
          );
        }
        continue;
      }

      if (fixedSamples.length < 12) {
        fixedSamples.push({
          id_lead: row.id_lead,
          raw: row.raw_value,
          id_attorney: resolved,
        });
      }

      if (dryRun) {
        fixed += 1;
        continue;
      }

      await conn.query(
        `UPDATE \`${db}\`.lead_legal SET id_attorney = ? WHERE id_lead = ?`,
        [resolved, row.id_lead]
      );
      if (row.id_reject) {
        await conn.query(
          `DELETE FROM \`${db}\`.import_reject WHERE id_reject = ?`,
          [row.id_reject]
        );
      } else {
        // limpia reject viejo si quedó con otro reason
        await conn.query(
          `DELETE FROM \`${db}\`.import_reject
           WHERE id_lead = ? AND field_name = 'attorney'`,
          [row.id_lead]
        );
      }
      fixed += 1;
    }

    if (fixedSamples.length) {
      console.log('  samples:');
      for (const s of fixedSamples) {
        console.log(`    ${s.id_lead}: "${s.raw}" → ${s.id_attorney}`);
      }
    }
    console.log(`\n  ✓ matched/fixed: ${fixed}`);
    console.log(`  · already ok:    ${alreadySet}`);
    console.log(`  · still miss:    ${stillMiss}`);
  });
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
  })
  .finally(() => closeAll());
