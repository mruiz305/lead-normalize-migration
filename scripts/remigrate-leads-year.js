#!/usr/bin/env node
/**
 * Borra leads de un año (por created) en el modelo normalizado y los vuelve a cargar.
 * No toca otros años.
 *
 * Origen:
 *   default      TNFG_INTAKE.tblLeads_src (copia local, puede estar desfasada)
 *   --from-prod  dbProduction.tblLeads (MIG_SOURCE_*) — usar esto si staging está mal
 *
 * Motivo: los idLead no son contiguos por año (hay solape 2025/2026), así que
 * migrate --resume no alcanza para rehacer solo un año.
 *
 * No borra sentinels (created=2100) ni IDs que ya no están en prod.
 * Para eso: npm run prune:leads-orphans  (o reload:full).
 *
 * Uso:
 *   node scripts/remigrate-leads-year.js --year 2026 --from-prod
 *   node scripts/remigrate-leads-year.js --year 2026 --from-prod --dry-run
 *   node scripts/remigrate-leads-year.js --year 2026 --from-prod --skip-delete
 *   node scripts/remigrate-leads-year.js --year 2026 --from-prod --skip-delete --after-id 497677
 *   node scripts/remigrate-leads-year.js --year 2026
 *   node scripts/remigrate-leads-year.js --year 2026 --delete-only
 *
 * Después (datamart): npm run sync -- --only tblLeads_mat  en tnfg-datamart-etl
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const config = require('../src/config');
const { withTarget, sourcePool, closeAll } = require('../src/db');
const { loadCatalogMaps } = require('../src/migration/maps');
const {
  LEAD_SELECT_COLUMNS,
  transformLead,
  flushLeadBatch,
} = require('../src/migration/pipeline');
const { syncInsuranceCatalog } = require('../src/migration/insurance');
const { syncAtFaultTypeCatalog } = require('../src/migration/atFaultTypeCatalog');
const { seedAccidentLocationTypes } = require('../src/migration/accidentLocationTypeCatalog');
const { seedSeverityLevels } = require('../src/migration/severityLevelCatalog');
const { syncInjurySiteCatalog } = require('../src/migration/injurySiteCatalog');

const BATCH = Number(process.env.MIG_BATCH_SIZE || 100);
const DEST_TABLE = process.env.MIG_SOURCE_LEADS_TABLE || 'tblLeads_src';
const PROD_LEADS_TABLE = (process.env.MIG_PROD_LEADS_TABLE || 'tblLeads').trim();
const ID_BATCH = 2000;

function parseArgs(argv) {
  const yearIdx = argv.indexOf('--year');
  const year = yearIdx >= 0 ? Number(argv[yearIdx + 1]) : NaN;
  const afterIdx = argv.indexOf('--after-id');
  return {
    year,
    fromProd: argv.includes('--from-prod'),
    dryRun: argv.includes('--dry-run'),
    deleteOnly: argv.includes('--delete-only'),
    skipDelete: argv.includes('--skip-delete'),
    afterId: afterIdx >= 0 ? Number(argv[afterIdx + 1]) : null,
    limit: (() => {
      const i = argv.indexOf('--limit');
      return i >= 0 ? Number(argv[i + 1]) : null;
    })(),
  };
}

function isRetryableLockError(err) {
  return (
    err.code === 'ER_LOCK_DEADLOCK' ||
    err.code === 'ER_LOCK_WAIT_TIMEOUT' ||
    err.errno === 1213 ||
    err.errno === 1205 ||
    /Deadlock found|Lock wait timeout/i.test(String(err.message || ''))
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function flushBatchWithRetry(targetConn, transformed, maps, { retries = 8 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    await targetConn.beginTransaction();
    try {
      await flushLeadBatch(targetConn, transformed, maps);
      await targetConn.commit();
      return;
    } catch (err) {
      try {
        await targetConn.rollback();
      } catch (_) {
        /* conexión ya abortada */
      }
      lastErr = err;
      if (!isRetryableLockError(err) || attempt === retries) throw err;
      const delay = Math.min(4000, 200 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 200);
      process.stdout.write(`\n  lock (${err.code || 'deadlock'}), reintento ${attempt}/${retries} en ${delay}ms`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

function leadsReadSql(fromProd) {
  if (fromProd) {
    return `\`${config.source.database}\`.\`${PROD_LEADS_TABLE}\``;
  }
  return `\`${config.target.database}\`.\`${DEST_TABLE}\``;
}

/** Catálogos (insurance, injury, …) también deben leer prod, no tblLeads_src. */
function applyFromProdSourceLeads() {
  const database = config.source.database;
  const table = PROD_LEADS_TABLE;
  config.sourceLeads.table = table;
  config.sourceLeads.database = database;
  config.sourceLeads.onTarget = false;
  config.sourceLeads.sql = `\`${database}\`.\`${table}\``;
}

function yearBounds(year) {
  return {
    from: `${year}-01-01 00:00:00`,
    to: `${year + 1}-01-01 00:00:00`,
  };
}

async function insertProdYearIds(sourceConn, targetConn, year) {
  const { from, to } = yearBounds(year);
  const sql = leadsReadSql(true);
  let lastId = 0;
  let inserted = 0;
  while (true) {
    const [rows] = await sourceConn.query(
      `SELECT idLead FROM ${sql}
       WHERE created >= ? AND created < ? AND idLead > ?
       ORDER BY idLead
       LIMIT ?`,
      [from, to, lastId, ID_BATCH]
    );
    if (!rows.length) break;
    const ids = rows.map((r) => Number(r.idLead));
    const ph = ids.map(() => '(?)').join(',');
    const [ins] = await targetConn.query(
      `INSERT IGNORE INTO tmp_remigrate_year_ids (id_lead) VALUES ${ph}`,
      ids
    );
    inserted += Number(ins.affectedRows || 0);
    lastId = ids[ids.length - 1];
  }
  return inserted;
}

async function collectYearIds(targetConn, db, year, { fromProd, sourceConn } = {}) {
  const { from, to } = yearBounds(year);
  await targetConn.query('DROP TEMPORARY TABLE IF EXISTS tmp_remigrate_year_ids');
  await targetConn.query(`
    CREATE TEMPORARY TABLE tmp_remigrate_year_ids (
      id_lead INT NOT NULL PRIMARY KEY
    ) ENGINE=Memory
  `);

  let insertedFromSrc;
  if (fromProd) {
    insertedFromSrc = await insertProdYearIds(sourceConn, targetConn, year);
  } else {
    const [insSrc] = await targetConn.query(
      `INSERT IGNORE INTO tmp_remigrate_year_ids (id_lead)
       SELECT idLead FROM \`${db}\`.\`${DEST_TABLE}\`
       WHERE created >= ? AND created < ?`,
      [from, to]
    );
    insertedFromSrc = Number(insSrc.affectedRows || 0);
  }

  // Residuales en modelo: solo los originados en Glide; los solo-portal no se remigran.
  const [insNorm] = await targetConn.query(
    `INSERT IGNORE INTO tmp_remigrate_year_ids (id_lead)
     SELECT glide_id FROM \`${db}\`.\`lead\`
     WHERE glide_id IS NOT NULL AND created_at >= ? AND created_at < ?`,
    [from, to]
  );

  const [[{ c }]] = await targetConn.query(
    'SELECT COUNT(*) AS c FROM tmp_remigrate_year_ids'
  );
  return {
    count: Number(c),
    insertedFromSrc,
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
    INNER JOIN tmp_remigrate_year_ids t ON t.id_lead = l.glide_id
  `);
  console.log(`    ${r0.affectedRows} filas`);

  console.log('  lead_party…');
  const [rParty] = await conn.query(`
    DELETE lp FROM \`${db}\`.lead_party lp
    INNER JOIN \`${db}\`.\`lead\` l ON l.id_lead = lp.id_lead
    INNER JOIN tmp_remigrate_year_ids t ON t.id_lead = l.glide_id
  `);
  console.log(`    ${rParty.affectedRows} filas`);

  for (const table of childDirect) {
    process.stdout.write(`  ${table}…`);
    const [r] = await conn.query(`
      DELETE c FROM \`${db}\`.\`${table}\` c
      INNER JOIN \`${db}\`.\`lead\` l ON l.id_lead = c.id_lead
      INNER JOIN tmp_remigrate_year_ids t ON t.id_lead = l.glide_id
    `);
    console.log(` ${r.affectedRows}`);
  }

  console.log('  lead…');
  const [rLead] = await conn.query(`
    DELETE l FROM \`${db}\`.\`lead\` l
    INNER JOIN tmp_remigrate_year_ids t ON t.id_lead = l.glide_id
  `);
  console.log(`    ${rLead.affectedRows} filas`);

  return Number(rLead.affectedRows);
}

async function remigrateYear(sourceConn, targetConn, maps, year, { limit = null, onProgress, fromProd = false, afterId = 0 } = {}) {
  const { from, to } = yearBounds(year);
  const colList = LEAD_SELECT_COLUMNS.map((c) => `\`${c}\``).join(', ');
  const readSql = leadsReadSql(fromProd);
  const readConn = fromProd ? sourceConn : targetConn;
  const cursorStart = Number.isFinite(afterId) && afterId > 0 ? afterId : 0;

  const [[{ pendingTotal }]] = await readConn.query(
    `SELECT COUNT(*) AS pendingTotal FROM ${readSql}
     WHERE created >= ? AND created < ? AND idLead > ?`,
    [from, to, cursorStart]
  );
  const cap = limit && limit > 0 ? Math.min(limit, pendingTotal) : pendingTotal;
  if (!cap) {
    return { migrated: 0, total: 0, pendingTotal, afterIdEnd: cursorStart };
  }

  let migrated = 0;
  let cursor = cursorStart;

  while (migrated < cap) {
    const take = Math.min(BATCH, cap - migrated);
    const [rows] = await readConn.query(
      `SELECT ${colList} FROM ${readSql}
       WHERE created >= ? AND created < ? AND idLead > ?
       ORDER BY idLead
       LIMIT ?`,
      [from, to, cursor, take]
    );
    if (!rows.length) break;

    const transformed = rows.map((row) => transformLead(row, maps));
    try {
      await flushBatchWithRetry(targetConn, transformed, maps);
    } catch (err) {
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
    console.error(
      'Uso: node scripts/remigrate-leads-year.js --year 2026 [--from-prod] [--dry-run] [--delete-only] [--skip-delete] [--after-id N] [--limit N]'
    );
    process.exit(1);
  }

  if (opts.fromProd && !config.hasSeparateSource) {
    console.error('--from-prod requiere MIG_SOURCE_* distinto de MIG_TARGET (dbProduction)');
    process.exit(1);
  }
  if (opts.fromProd) {
    applyFromProdSourceLeads();
  }

  const db = config.target.database;
  const { from, to } = yearBounds(opts.year);
  const originLabel = opts.fromProd
    ? `${config.source.host}/${config.source.database}.${PROD_LEADS_TABLE}`
    : `${config.target.host}/${db}.${DEST_TABLE}`;
  console.log(`Remigrar leads año ${opts.year}`);
  console.log(`  Destino: ${config.target.host}/${db}`);
  console.log(`  Origen:  ${originLabel}${opts.fromProd ? ' (producción)' : ' (staging local)'}`);
  console.log(`  Rango:   created >= ${from} AND created < ${to}`);
  console.log(`  Modo:    ${opts.dryRun ? 'dry-run' : opts.deleteOnly ? 'delete-only' : 'delete+reload'}\n`);

  const needSource = opts.fromProd || (!opts.dryRun && !opts.deleteOnly);

  await withTarget(async (targetConn) => {
    const sourceConn = needSource ? await sourcePool.getConnection() : null;
    try {
      const ids = await collectYearIds(targetConn, db, opts.year, {
        fromProd: opts.fromProd,
        sourceConn,
      });
      console.log(`IDs a tocar: ${ids.count} (src+${ids.insertedFromSrc} / norm+${ids.insertedFromNorm})`);

      const [[pre]] = await targetConn.query(
        `SELECT COUNT(*) AS c FROM \`${db}\`.\`lead\`
         WHERE created_at >= ? AND created_at < ?`,
        [from, to]
      );
      let srcCount;
      if (opts.fromProd) {
        const [[src]] = await sourceConn.query(
          `SELECT COUNT(*) AS c FROM ${leadsReadSql(true)}
           WHERE created >= ? AND created < ?`,
          [from, to]
        );
        srcCount = src.c;
      } else {
        const [[src]] = await targetConn.query(
          `SELECT COUNT(*) AS c FROM \`${db}\`.\`${DEST_TABLE}\`
           WHERE created >= ? AND created < ?`,
          [from, to]
        );
        srcCount = src.c;
      }
      const [[keep]] = await targetConn.query(
        `SELECT COUNT(*) AS c FROM \`${db}\`.\`lead\`
         WHERE created_at < ? OR created_at >= ?`,
        [from, to]
      );
      console.log(`  en modelo (created_at año): ${pre.c}`);
      console.log(`  en ${opts.fromProd ? 'prod' : 'staging'} (created año): ${srcCount}`);
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

      let afterId = Number.isFinite(opts.afterId) && opts.afterId > 0 ? opts.afterId : 0;
      if (opts.skipDelete && !afterId) {
        const [[row]] = await targetConn.query(
          `SELECT COALESCE(MAX(glide_id), 0) AS maxId
           FROM \`${db}\`.\`lead\`
           WHERE created_at >= ? AND created_at < ?`,
          [from, to]
        );
        afterId = Number(row.maxId) || 0;
      }
      if (afterId) {
        console.log(`  resume desde idLead > ${afterId} (no se reinsertan los ya cargados)\n`);
      }

      console.log('Paso 2: catálogos / maps…');
      console.log('  org snapshot ← tblLeads (no g_users / hierarchy_membership)');
      await syncInsuranceCatalog(sourceConn, targetConn, { truncate: false, afterId: 0 });
      await seedAccidentLocationTypes(targetConn);
      await syncAtFaultTypeCatalog(sourceConn, targetConn, { truncate: false });
      await seedSeverityLevels(targetConn);
      await syncInjurySiteCatalog(sourceConn, targetConn, { truncate: false });
      const maps = await loadCatalogMaps(targetConn);

      console.log(`Paso 3: migrar año ${opts.year} desde ${opts.fromProd ? 'prod' : 'staging'}…`);
      const started = Date.now();
      const result = await remigrateYear(sourceConn, targetConn, maps, opts.year, {
        limit: opts.limit,
        fromProd: opts.fromProd,
        afterId,
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
      console.log('\nSiguiente: datamart → npm run sync -- --only tblLeads_mat');
    } finally {
      if (sourceConn) sourceConn.release();
    }
  });
}

main()
  .catch((e) => {
    console.error('\nError:', e.message || e);
    process.exitCode = 1;
  })
  .finally(() => closeAll());
