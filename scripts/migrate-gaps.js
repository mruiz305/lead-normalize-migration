#!/usr/bin/env node
/**
 * Migra leads que están en tblLeads_src pero no en `lead` (huecos que --resume no ve).
 * --resume avanza por MAX(glide_id); este script cubre idLead ≤ watermark sin fila (match por glide_id).
 *
 * Uso:
 *   npm run migrate:gaps
 *   npm run migrate:gaps -- --dry-run
 *   npm run migrate:gaps -- --limit 500
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const config = require('../src/config');
const { withTarget, withSource, closeAll } = require('../src/db');
const { loadCatalogMaps } = require('../src/migration/maps');
const {
  LEAD_SELECT_COLUMNS,
  transformLead,
  flushLeadBatch,
} = require('../src/migration/pipeline');
const { populateHierarchyMembership } = require('../src/migration/hierarchyMembership');
const { syncInsuranceCatalog } = require('../src/migration/insurance');
const { syncAtFaultTypeCatalog } = require('../src/migration/atFaultTypeCatalog');
const { seedAccidentLocationTypes } = require('../src/migration/accidentLocationTypeCatalog');
const { seedSeverityLevels } = require('../src/migration/severityLevelCatalog');
const { syncInjurySiteCatalog } = require('../src/migration/injurySiteCatalog');

const BATCH = Number(process.env.MIG_BATCH_SIZE || 100);
const DEST_TABLE = process.env.MIG_SOURCE_LEADS_TABLE || 'tblLeads_src';
const TMP = 'tmp_migrate_gap_ids';

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    limit: (() => {
      const i = argv.indexOf('--limit');
      return i >= 0 ? Number(argv[i + 1]) : null;
    })(),
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const db = config.target.database;
  console.log('Migrar gaps: tblLeads_src sin fila en lead');
  console.log(`  Destino: ${config.target.host}/${db}`);
  console.log(`  Staging: ${db}.${DEST_TABLE}`);
  console.log(`  Modo:    ${opts.dryRun ? 'dry-run' : 'migrate'}\n`);

  await withTarget(async (conn) => {
    await withSource(async (sourceConn) => {
    await conn.query(`DROP TEMPORARY TABLE IF EXISTS ${TMP}`);
    await conn.query(`
      CREATE TEMPORARY TABLE ${TMP} (
        id_lead INT NOT NULL PRIMARY KEY
      ) ENGINE=Memory
    `);
    const [ins] = await conn.query(
      `INSERT INTO ${TMP} (id_lead)
       SELECT s.idLead
       FROM \`${db}\`.\`${DEST_TABLE}\` s
       LEFT JOIN \`${db}\`.\`lead\` l ON COALESCE(l.glide_id, l.id_lead) = s.idLead
       WHERE l.id_lead IS NULL`
    );
    const [[{ c }]] = await conn.query(`SELECT COUNT(*) AS c FROM ${TMP}`);
    const gapCount = Number(c);
    console.log(`Gaps encontrados: ${gapCount} (insert ${ins.affectedRows})`);
    if (!gapCount) {
      console.log('Nada que migrar.');
      return;
    }

    const [[{ mn, mx }]] = await conn.query(
      `SELECT MIN(id_lead) mn, MAX(id_lead) mx FROM ${TMP}`
    );
    console.log(`  idLead range: ${mn} … ${mx}`);

    if (opts.dryRun) {
      const [sample] = await conn.query(
        `SELECT id_lead FROM ${TMP} ORDER BY id_lead LIMIT 20`
      );
      console.log('  sample:', sample.map((r) => r.id_lead).join(', '));
      return;
    }

    console.log('Cargando catálogos…');
    const maps = await loadCatalogMaps(conn);
    await syncInsuranceCatalog(sourceConn, conn, { truncate: false, afterId: 0 });
    await syncAtFaultTypeCatalog(sourceConn, conn, { truncate: false });
    await seedAccidentLocationTypes(conn);
    await seedSeverityLevels(conn);
    await syncInjurySiteCatalog(sourceConn, conn, { truncate: false });

    const colList = LEAD_SELECT_COLUMNS.map((c) => `\`${c}\``).join(', ');
    const cap =
      opts.limit && opts.limit > 0 ? Math.min(opts.limit, gapCount) : gapCount;
    let migrated = 0;
    let cursor = 0;

    while (migrated < cap) {
      const take = Math.min(BATCH, cap - migrated);
      const [rows] = await conn.query(
        `SELECT ${colList}
         FROM \`${db}\`.\`${DEST_TABLE}\` s
         INNER JOIN ${TMP} t ON t.id_lead = s.idLead
         WHERE s.idLead > ?
         ORDER BY s.idLead
         LIMIT ?`,
        [cursor, take]
      );
      if (!rows.length) break;

      const transformed = rows.map((row) => transformLead(row, maps));
      await conn.beginTransaction();
      try {
        await flushLeadBatch(conn, transformed, maps);
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw new Error(`Batch after idLead ${cursor}: ${err.message}`);
      }

      cursor = rows[rows.length - 1].idLead;
      migrated += rows.length;
      console.log(`  migrados ${migrated}/${cap} (hasta ${cursor})`);
    }

    console.log('populateHierarchyMembership…');
    await populateHierarchyMembership(sourceConn, conn, { truncate: false });

    const [[{ remaining }]] = await conn.query(
      `SELECT COUNT(*) AS remaining
       FROM \`${db}\`.\`${DEST_TABLE}\` s
       LEFT JOIN \`${db}\`.\`lead\` l ON COALESCE(l.glide_id, l.id_lead) = s.idLead
       WHERE l.id_lead IS NULL`
    );
    console.log(`\n✓ Migrados ${migrated}. Gaps restantes en src: ${remaining}`);
    });
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => closeAll());
