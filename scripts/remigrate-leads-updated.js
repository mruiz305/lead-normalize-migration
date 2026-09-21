#!/usr/bin/env node
/**
 * Re-migra leads cuyo `updated` es >= --since.
 * Actualiza `lead` y sus hijos in-place (mismo id_lead / id_client).
 *
 * Origen:
 *   default      TNFG_INTAKE.tblLeads_src
 *   --from-prod  dbProduction.tblLeads
 *
 * lead_org_snapshot se reconstruye desde columnas org de tblLeads
 * (officeLabel, region, pod, team, duo…). No se toma de g_users.
 *
 * Uso:
 *   npm run remigrate:updated -- --since "2026-09-08 00:00:00" --from-prod
 *   npm run remigrate:updated -- --this-week --dry-run
 *   npm run remigrate:updated -- --since "2026-08-17 00:00:00"
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const config = require('../src/config');
const { withTarget, sourcePool, closeAll } = require('../src/db');
const { loadCatalogMaps } = require('../src/migration/maps');
const {
  LEAD_SELECT_COLUMNS,
  transformLead,
  stampLeadUpdatedNow,
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
const TMP = 'tmp_remigrate_updated_ids';

function mondayOfThisWeek(d = new Date()) {
  const x = new Date(d);
  const day = x.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function fmtLocal(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function parseArgs(argv) {
  const sinceIdx = argv.indexOf('--since');
  let since = sinceIdx >= 0 ? argv[sinceIdx + 1] : null;
  if (argv.includes('--this-week')) {
    since = fmtLocal(mondayOfThisWeek());
  }
  return {
    since,
    fromProd: argv.includes('--from-prod'),
    dryRun: argv.includes('--dry-run'),
    deleteOnly: argv.includes('--delete-only'),
    skipDelete: argv.includes('--skip-delete'),
    limit: (() => {
      const i = argv.indexOf('--limit');
      return i >= 0 ? Number(argv[i + 1]) : null;
    })(),
  };
}

function leadsReadSql(fromProd) {
  if (fromProd) {
    return `\`${config.source.database}\`.\`${PROD_LEADS_TABLE}\``;
  }
  return `\`${config.target.database}\`.\`${DEST_TABLE}\``;
}

function applyFromProdSourceLeads() {
  const database = config.source.database;
  const table = PROD_LEADS_TABLE;
  config.sourceLeads.table = table;
  config.sourceLeads.database = database;
  config.sourceLeads.onTarget = false;
  config.sourceLeads.sql = `\`${database}\`.\`${table}\``;
}

async function collectIdsFromProd(sourceConn, targetConn, since) {
  await targetConn.query(`DROP TEMPORARY TABLE IF EXISTS ${TMP}`);
  await targetConn.query(`
    CREATE TEMPORARY TABLE ${TMP} (
      id_lead INT NOT NULL PRIMARY KEY
    ) ENGINE=Memory
  `);
  const sql = leadsReadSql(true);
  let lastId = 0;
  let inserted = 0;
  while (true) {
    const [rows] = await sourceConn.query(
      `SELECT idLead FROM ${sql}
       WHERE updated >= ? AND idLead > ?
       ORDER BY idLead
       LIMIT ?`,
      [since, lastId, ID_BATCH]
    );
    if (!rows.length) break;
    const ids = rows.map((r) => Number(r.idLead));
    const ph = ids.map(() => '(?)').join(',');
    const [ins] = await targetConn.query(
      `INSERT IGNORE INTO ${TMP} (id_lead) VALUES ${ph}`,
      ids
    );
    inserted += Number(ins.affectedRows || 0);
    lastId = ids[ids.length - 1];
  }
  const [[{ c }]] = await targetConn.query(`SELECT COUNT(*) AS c FROM ${TMP}`);
  return { count: Number(c), inserted };
}

async function collectIds(conn, db, since) {
  await conn.query(`DROP TEMPORARY TABLE IF EXISTS ${TMP}`);
  await conn.query(`
    CREATE TEMPORARY TABLE ${TMP} (
      id_lead INT NOT NULL PRIMARY KEY
    ) ENGINE=Memory
  `);
  const [ins] = await conn.query(
    `INSERT IGNORE INTO ${TMP} (id_lead)
     SELECT idLead FROM \`${db}\`.\`${DEST_TABLE}\`
     WHERE updated >= ?`,
    [since]
  );
  const [[{ c }]] = await conn.query(`SELECT COUNT(*) AS c FROM ${TMP}`);
  return { count: Number(c), inserted: Number(ins.affectedRows || 0) };
}

/**
 * Saca de TMP los idLead que en el modelo pertenecen a un lead del portal.
 * Sin esto los hijos del portal se borrarían, y el UPDATE chocaría
 * contra el UNIQUE de glide_id.
 */
async function dropPortalOwned(conn, db) {
  const [r] = await conn.query(`
    DELETE t FROM ${TMP} t
    INNER JOIN \`${db}\`.\`lead\` l ON l.glide_id = t.id_lead
    WHERE l.origin = 'PORTAL'
  `);
  return Number(r.affectedRows || 0);
}

/** glide_id → id_lead: el UPDATE usa este PK; no se recicla. */
async function collectExistingLeadIds(targetConn, db) {
  const [rows] = await targetConn.query(
    `SELECT l.glide_id, l.id_lead FROM \`${db}\`.\`lead\` l
     INNER JOIN ${TMP} t ON t.id_lead = l.glide_id
     WHERE l.origin = 'GLIDE'`
  );
  return new Map(rows.map((r) => [Number(r.glide_id), Number(r.id_lead)]));
}

async function remigrateCollected(
  readConn,
  targetConn,
  maps,
  { limit = null, onProgress, fromProd = false, preserveLeadIds = null } = {}
) {
  const db = config.target.database;
  const colList = LEAD_SELECT_COLUMNS.map((c) => `\`${c}\``).join(', ');
  const readSql = leadsReadSql(fromProd);

  const [[{ pendingTotal }]] = await targetConn.query(
    `SELECT COUNT(*) AS pendingTotal FROM ${TMP}`
  );
  const cap = limit && limit > 0 ? Math.min(limit, pendingTotal) : pendingTotal;
  if (!cap) return { migrated: 0, total: 0, pendingTotal };

  let migrated = 0;
  let cursor = 0;

  while (migrated < cap) {
    const take = Math.min(BATCH, cap - migrated);
    const [idRows] = await targetConn.query(
      `SELECT id_lead FROM ${TMP} WHERE id_lead > ? ORDER BY id_lead LIMIT ?`,
      [cursor, take]
    );
    if (!idRows.length) break;
    const ids = idRows.map((r) => Number(r.id_lead));
    const ph = ids.map(() => '?').join(',');
    const [rows] = await readConn.query(
      `SELECT ${colList} FROM ${readSql} WHERE idLead IN (${ph}) ORDER BY idLead`,
      ids
    );
    if (!rows.length) break;

    const transformed = rows.map((row) => stampLeadUpdatedNow(transformLead(row, maps)));
    await targetConn.beginTransaction();
    try {
      await flushLeadBatch(targetConn, transformed, maps, { preserveLeadIds });
      await targetConn.commit();
    } catch (err) {
      await targetConn.rollback();
      throw new Error(`Batch after idLead ${cursor}: ${err.message}`);
    }

    cursor = ids[ids.length - 1];
    migrated += rows.length;
    if (onProgress) onProgress(migrated, cap);
  }

  return { migrated, total: cap, pendingTotal, afterIdEnd: cursor };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.since) {
    console.error(
      'Uso: node scripts/remigrate-leads-updated.js --this-week | --since "YYYY-MM-DD HH:MM:SS" [--from-prod] [--dry-run]'
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
  const originLabel = opts.fromProd
    ? `${config.source.host}/${config.source.database}.${PROD_LEADS_TABLE}`
    : `${config.target.host}/${db}.${DEST_TABLE}`;
  console.log('Remigrar leads actualizados');
  console.log(`  Destino: ${config.target.host}/${db}`);
  console.log(`  Origen:  ${originLabel}${opts.fromProd ? ' (producción)' : ' (staging local)'}`);
  console.log(`  Filtro:  updated >= ${opts.since}`);
  console.log(`  Modo:    ${opts.dryRun ? 'dry-run' : 'update lead + hijos'}\n`);

  await withTarget(async (targetConn) => {
    const needSource = opts.fromProd || (!opts.dryRun && !opts.deleteOnly);
    const sourceConn = needSource ? await sourcePool.getConnection() : null;
    try {
      const ids = opts.fromProd
        ? await collectIdsFromProd(sourceConn, targetConn, opts.since)
        : await collectIds(targetConn, db, opts.since);
      const skippedPortal = await dropPortalOwned(targetConn, db);
      const [[inNorm]] = await targetConn.query(
        `SELECT COUNT(*) AS c FROM \`${db}\`.\`lead\` l
         INNER JOIN ${TMP} t ON t.id_lead = l.glide_id`
      );
      const [[keep]] = await targetConn.query(
        `SELECT COUNT(*) AS c FROM \`${db}\`.\`lead\` l
         LEFT JOIN ${TMP} t ON t.id_lead = l.glide_id
         WHERE t.id_lead IS NULL`
      );

      console.log(`IDs con updated >= since: ${ids.count}`);
      if (skippedPortal) {
        console.log(`  omitidos por ser del portal: ${skippedPortal}`);
      }
      console.log(`  ya en modelo (se actualizan): ${inNorm.c}`);
      console.log(`  resto del modelo (intactos): ${keep.c}\n`);

      if (opts.dryRun) {
        console.log('(dry-run) no se actualizó nada');
        return;
      }

      if (opts.deleteOnly) {
        console.log('(--delete-only ignorado: ya no se borran hijos; se actualizan)');
        return;
      }

      const preserveLeadIds = await collectExistingLeadIds(targetConn, db);

      console.log('Paso 1: catálogos / maps…');
      console.log('  org snapshot ← tblLeads (no g_users / hierarchy_membership)');
      await syncInsuranceCatalog(sourceConn, targetConn, { truncate: false, afterId: 0 });
      await seedAccidentLocationTypes(targetConn);
      await syncAtFaultTypeCatalog(sourceConn, targetConn, { truncate: false });
      await seedSeverityLevels(targetConn);
      await syncInjurySiteCatalog(sourceConn, targetConn, { truncate: false });
      const maps = await loadCatalogMaps(targetConn);

      console.log(`Paso 2: actualizar desde ${opts.fromProd ? 'prod' : 'staging'}…`);
      if (preserveLeadIds.size) {
        console.log(`  actualizando el id_lead original de ${preserveLeadIds.size} leads`);
      }
      const started = Date.now();
      const result = await remigrateCollected(
        opts.fromProd ? sourceConn : targetConn,
        targetConn,
        maps,
        {
        limit: opts.limit,
        fromProd: opts.fromProd,
        preserveLeadIds,
        onProgress(done, tot) {
          process.stdout.write(`\r  ${done}/${tot} (${((done / tot) * 100).toFixed(1)}%)`);
        },
      });
      console.log(
        `\n  ✓ ${result.migrated}/${result.total} leads — ${((Date.now() - started) / 1000).toFixed(0)}s` +
          (result.afterIdEnd ? ` (hasta idLead ${result.afterIdEnd})` : '')
      );
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
