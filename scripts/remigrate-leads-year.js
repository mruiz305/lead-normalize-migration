#!/usr/bin/env node
/**
 * Borra leads de un año (por created) en el modelo normalizado y los vuelve a cargar
 * desde tblLeads_src. No toca otros años.
 *
 * Motivo: los idLead no son contiguos por año (hay solape 2025/2026), así que
 * migrate --resume no alcanza para rehacer solo un año.
 *
 * Uso:
 *   node scripts/remigrate-leads-year.js --year 2026
 *   node scripts/remigrate-leads-year.js --year 2026 --dry-run
 *   node scripts/remigrate-leads-year.js --year 2026 --delete-only
 *   node scripts/remigrate-leads-year.js --year 2026 --skip-delete
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const config = require('../src/config');
const { withTarget, withSource, sourcePool, targetPool, closeAll } = require('../src/db');
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

function parseArgs(argv) {
  const yearIdx = argv.indexOf('--year');
  const year = yearIdx >= 0 ? Number(argv[yearIdx + 1]) : NaN;
  return {
    year,
    dryRun: argv.includes('--dry-run'),
    deleteOnly: argv.includes('--delete-only'),
    skipDelete: argv.includes('--skip-delete'),
    limit: (() => {
      const i = argv.indexOf('--limit');
      return i >= 0 ? Number(argv[i + 1]) : null;
    })(),
  };
}

function yearBounds(year) {
  return {
    from: `${year}-01-01 00:00:00`,
    to: `${year + 1}-01-01 00:00:00`,
  };
}

async function collectYearIds(conn, db, year) {
  const { from, to } = yearBounds(year);
  await conn.query('DROP TEMPORARY TABLE IF EXISTS tmp_remigrate_year_ids');
  await conn.query(`
    CREATE TEMPORARY TABLE tmp_remigrate_year_ids (
      id_lead INT NOT NULL PRIMARY KEY
    ) ENGINE=Memory
  `);

  // IDs en staging del año (idLead Glide)
  const [insSrc] = await conn.query(
    `INSERT IGNORE INTO tmp_remigrate_year_ids (id_lead)
     SELECT idLead FROM \`${db}\`.\`${DEST_TABLE}\`
     WHERE created >= ? AND created < ?`,
    [from, to]
  );

  // Residuales en modelo: usar glide_id si existe (puente), si no id_lead histórico
  const [insNorm] = await conn.query(
    `INSERT IGNORE INTO tmp_remigrate_year_ids (id_lead)
     SELECT COALESCE(glide_id, id_lead) FROM \`${db}\`.\`lead\`
     WHERE created_at >= ? AND created_at < ?`,
    [from, to]
  );

  const [[{ c }]] = await conn.query(
    'SELECT COUNT(*) AS c FROM tmp_remigrate_year_ids'
  );
  return {
    count: Number(c),
    insertedFromSrc: Number(insSrc.affectedRows || 0),
    insertedFromNorm: Number(insNorm.affectedRows || 0),
  };
}

async function deleteYearLeads(conn, db, year) {
  const childDirect = [
    'lead_insurance',
    'lead_note',
    'lead_staff',
    'lead_sync_flag',
    'lead_status_event',
    'lead_injury_site',
    'lead_injury',
    'lead_accident',
    'lead_legal',
    'lead_clinical',
    'lead_timeline',
    'lead_org_snapshot',
    'import_reject',
  ];

  console.log('  lead_party_injury_site…');
  const [r0] = await conn.query(`
    DELETE lpis FROM \`${db}\`.lead_party_injury_site lpis
    INNER JOIN \`${db}\`.lead_party lp ON lp.id_lead_party = lpis.id_lead_party
    INNER JOIN \`${db}\`.\`lead\` l ON l.id_lead = lp.id_lead
    INNER JOIN tmp_remigrate_year_ids t ON t.id_lead = COALESCE(l.glide_id, l.id_lead)
  `);
  console.log(`    ${r0.affectedRows} filas`);

  console.log('  lead_party…');
  const [rParty] = await conn.query(`
    DELETE lp FROM \`${db}\`.lead_party lp
    INNER JOIN \`${db}\`.\`lead\` l ON l.id_lead = lp.id_lead
    INNER JOIN tmp_remigrate_year_ids t ON t.id_lead = COALESCE(l.glide_id, l.id_lead)
  `);
  console.log(`    ${rParty.affectedRows} filas`);

  for (const table of childDirect) {
    process.stdout.write(`  ${table}…`);
    const [r] = await conn.query(`
      DELETE c FROM \`${db}\`.\`${table}\` c
      INNER JOIN \`${db}\`.\`lead\` l ON l.id_lead = c.id_lead
      INNER JOIN tmp_remigrate_year_ids t ON t.id_lead = COALESCE(l.glide_id, l.id_lead)
    `);
    console.log(` ${r.affectedRows}`);
  }

  console.log('  lead…');
  const [rLead] = await conn.query(`
    DELETE l FROM \`${db}\`.\`lead\` l
    INNER JOIN tmp_remigrate_year_ids t ON t.id_lead = COALESCE(l.glide_id, l.id_lead)
  `);
  console.log(`    ${rLead.affectedRows} filas`);

  return Number(rLead.affectedRows);
}

async function remigrateYear(sourceConn, targetConn, maps, year, { limit = null, onProgress } = {}) {
  const db = config.target.database;
  const { from, to } = yearBounds(year);
  const colList = LEAD_SELECT_COLUMNS.map((c) => `\`${c}\``).join(', ');

  const [[{ pendingTotal }]] = await targetConn.query(
    `SELECT COUNT(*) AS pendingTotal FROM \`${db}\`.\`${DEST_TABLE}\`
     WHERE created >= ? AND created < ?`,
    [from, to]
  );
  const cap = limit && limit > 0 ? Math.min(limit, pendingTotal) : pendingTotal;
  if (!cap) {
    return { migrated: 0, total: 0, pendingTotal };
  }

  let migrated = 0;
  let cursor = 0;

  while (migrated < cap) {
    const take = Math.min(BATCH, cap - migrated);
    const [rows] = await targetConn.query(
      `SELECT ${colList} FROM \`${db}\`.\`${DEST_TABLE}\`
       WHERE created >= ? AND created < ? AND idLead > ?
       ORDER BY idLead
       LIMIT ?`,
      [from, to, cursor, take]
    );
    if (!rows.length) break;

    const transformed = rows.map((row) => transformLead(row, maps));
    await targetConn.beginTransaction();
    try {
      await flushLeadBatch(targetConn, transformed, maps);
      await targetConn.commit();
    } catch (err) {
      await targetConn.rollback();
      throw new Error(`Batch after idLead ${cursor}: ${err.message}`);
    }

    cursor = rows[rows.length - 1].idLead;
    migrated += rows.length;
    if (onProgress) onProgress(migrated, cap);
  }

  return { migrated, total: cap, pendingTotal, afterIdEnd: cursor };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!Number.isInteger(opts.year) || opts.year < 2000 || opts.year > 2100) {
    console.error('Uso: node scripts/remigrate-leads-year.js --year 2026 [--dry-run] [--delete-only] [--skip-delete] [--limit N]');
    process.exit(1);
  }

  const db = config.target.database;
  const { from, to } = yearBounds(opts.year);
  console.log(`Remigrar leads año ${opts.year}`);
  console.log(`  Destino: ${config.target.host}/${db}`);
  console.log(`  Staging: ${db}.${DEST_TABLE}`);
  console.log(`  Rango:   created >= ${from} AND created < ${to}`);
  console.log(`  Modo:    ${opts.dryRun ? 'dry-run' : opts.deleteOnly ? 'delete-only' : 'delete+reload'}\n`);

  await withTarget(async (targetConn) => {
    const ids = await collectYearIds(targetConn, db, opts.year);
    console.log(`IDs a tocar: ${ids.count} (src+${ids.insertedFromSrc} / norm+${ids.insertedFromNorm})`);

    const [[pre]] = await targetConn.query(
      `SELECT COUNT(*) AS c FROM \`${db}\`.\`lead\`
       WHERE created_at >= ? AND created_at < ?`,
      [from, to]
    );
    const [[src]] = await targetConn.query(
      `SELECT COUNT(*) AS c FROM \`${db}\`.\`${DEST_TABLE}\`
       WHERE created >= ? AND created < ?`,
      [from, to]
    );
    const [[keep]] = await targetConn.query(
      `SELECT COUNT(*) AS c FROM \`${db}\`.\`lead\`
       WHERE created_at < ? OR created_at >= ?`,
      [from, to]
    );
    console.log(`  en modelo (created_at año): ${pre.c}`);
    console.log(`  en staging (created año):   ${src.c}`);
    console.log(`  otros años (se conservan):  ${keep.c}\n`);

    if (opts.dryRun) {
      console.log('(dry-run) no se borró ni migró nada');
      return;
    }

    if (!opts.skipDelete) {
      console.log('Paso 1: borrar hijos + lead del año…');
      const deleted = await deleteYearLeads(targetConn, db, opts.year);
      console.log(`  ✓ borrados ${deleted} leads\n`);
    } else {
      console.log('Paso 1: skip-delete\n');
    }

    if (opts.deleteOnly) {
      console.log('(--delete-only) listo');
      return;
    }

    const sourceConn = await sourcePool.getConnection();
    try {
      console.log('Paso 2: catálogos / maps…');
      await populateHierarchyMembership(sourceConn, targetConn, { truncate: true });
      await syncInsuranceCatalog(sourceConn, targetConn, { truncate: false, afterId: 0 });
      await seedAccidentLocationTypes(targetConn);
      await syncAtFaultTypeCatalog(sourceConn, targetConn, { truncate: false });
      await seedSeverityLevels(targetConn);
      await syncInjurySiteCatalog(sourceConn, targetConn, { truncate: false });
      const maps = await loadCatalogMaps(targetConn);

      console.log(`Paso 3: migrar año ${opts.year}…`);
      const started = Date.now();
      const result = await remigrateYear(sourceConn, targetConn, maps, opts.year, {
        limit: opts.limit,
        onProgress(done, tot) {
          const pct = ((done / tot) * 100).toFixed(1);
          process.stdout.write(`\r  ${done}/${tot} (${pct}%)`);
        },
      });
      console.log(
        `\n  ✓ ${result.migrated}/${result.total} leads` +
          ` — ${((Date.now() - started) / 1000).toFixed(0)}s` +
          (result.afterIdEnd ? ` (hasta idLead ${result.afterIdEnd})` : '')
      );

      const [[post]] = await targetConn.query(
        `SELECT COUNT(*) AS c, MIN(id_lead) minId, MAX(id_lead) maxId
         FROM \`${db}\`.\`lead\`
         WHERE created_at >= ? AND created_at < ?`,
        [from, to]
      );
      const [[other]] = await targetConn.query(
        `SELECT COUNT(*) AS c FROM \`${db}\`.\`lead\`
         WHERE created_at < ? OR created_at >= ?`,
        [from, to]
      );
      console.log(`\nPost: año ${opts.year}=${post.c} (${post.minId}→${post.maxId}) · otros años=${other.c}`);
    } finally {
      sourceConn.release();
    }
  });
}

main()
  .catch((e) => {
    console.error('\nError:', e.message || e);
    process.exitCode = 1;
  })
  .finally(() => closeAll());
