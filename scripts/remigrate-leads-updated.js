#!/usr/bin/env node
/**
 * Re-migra leads cuyo `updated` en staging/prod es >= --since.
 * Borra esos ids en el modelo normalizado y los vuelve a cargar desde tblLeads_src.
 *
 * Uso:
 *   npm run remigrate:updated -- --this-week --dry-run
 *   npm run remigrate:updated -- --since "2026-08-17 00:00:00"
 *   npm run remigrate:updated -- --this-week
 *
 * Tip: antes conviene refrescar staging:
 *   npm run sync:tblLeads-src -- --since "2026-08-17 00:00:00"
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
const { populateHierarchyMembership } = require('../src/migration/hierarchyMembership');
const { syncInsuranceCatalog } = require('../src/migration/insurance');
const { syncAtFaultTypeCatalog } = require('../src/migration/atFaultTypeCatalog');
const { seedAccidentLocationTypes } = require('../src/migration/accidentLocationTypeCatalog');
const { seedSeverityLevels } = require('../src/migration/severityLevelCatalog');
const { syncInjurySiteCatalog } = require('../src/migration/injurySiteCatalog');

const BATCH = Number(process.env.MIG_BATCH_SIZE || 100);
const DEST_TABLE = process.env.MIG_SOURCE_LEADS_TABLE || 'tblLeads_src';
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
    dryRun: argv.includes('--dry-run'),
    deleteOnly: argv.includes('--delete-only'),
    skipDelete: argv.includes('--skip-delete'),
    limit: (() => {
      const i = argv.indexOf('--limit');
      return i >= 0 ? Number(argv[i + 1]) : null;
    })(),
  };
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

async function deleteCollected(conn, db) {
  // TMP.id_lead = idLead Glide/src → resolver lead local vía glide_id (fallback id_lead).
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
    INNER JOIN ${TMP} t ON t.id_lead = COALESCE(l.glide_id, l.id_lead)
  `);
  console.log(`    ${r0.affectedRows}`);

  console.log('  lead_party…');
  const [rParty] = await conn.query(`
    DELETE lp FROM \`${db}\`.lead_party lp
    INNER JOIN \`${db}\`.\`lead\` l ON l.id_lead = lp.id_lead
    INNER JOIN ${TMP} t ON t.id_lead = COALESCE(l.glide_id, l.id_lead)
  `);
  console.log(`    ${rParty.affectedRows}`);

  for (const table of childDirect) {
    process.stdout.write(`  ${table}…`);
    const [r] = await conn.query(`
      DELETE c FROM \`${db}\`.\`${table}\` c
      INNER JOIN \`${db}\`.\`lead\` l ON l.id_lead = c.id_lead
      INNER JOIN ${TMP} t ON t.id_lead = COALESCE(l.glide_id, l.id_lead)
    `);
    console.log(` ${r.affectedRows}`);
  }

  console.log('  lead…');
  const [rLead] = await conn.query(`
    DELETE l FROM \`${db}\`.\`lead\` l
    INNER JOIN ${TMP} t ON t.id_lead = COALESCE(l.glide_id, l.id_lead)
  `);
  console.log(`    ${rLead.affectedRows}`);
  return Number(rLead.affectedRows);
}

async function remigrateCollected(targetConn, maps, { limit = null, onProgress } = {}) {
  const db = config.target.database;
  const colList = LEAD_SELECT_COLUMNS.map((c) => `\`${c}\``).join(', ');

  const [[{ pendingTotal }]] = await targetConn.query(
    `SELECT COUNT(*) AS pendingTotal
     FROM \`${db}\`.\`${DEST_TABLE}\` s
     INNER JOIN ${TMP} t ON t.id_lead = s.idLead`
  );
  const cap = limit && limit > 0 ? Math.min(limit, pendingTotal) : pendingTotal;
  if (!cap) return { migrated: 0, total: 0, pendingTotal };

  let migrated = 0;
  let cursor = 0;

  while (migrated < cap) {
    const take = Math.min(BATCH, cap - migrated);
    const [rows] = await targetConn.query(
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
  if (!opts.since) {
    console.error(
      'Uso: node scripts/remigrate-leads-updated.js --this-week | --since "YYYY-MM-DD HH:MM:SS" [--dry-run]'
    );
    process.exit(1);
  }

  const db = config.target.database;
  console.log('Remigrar leads actualizados');
  console.log(`  Destino: ${config.target.host}/${db}`);
  console.log(`  Staging: ${db}.${DEST_TABLE}`);
  console.log(`  Filtro:  updated >= ${opts.since}`);
  console.log(`  Modo:    ${opts.dryRun ? 'dry-run' : opts.deleteOnly ? 'delete-only' : 'delete+reload'}\n`);

  await withTarget(async (targetConn) => {
    const ids = await collectIds(targetConn, db, opts.since);
    const [[inNorm]] = await targetConn.query(
      `SELECT COUNT(*) AS c FROM \`${db}\`.\`lead\` l
       INNER JOIN ${TMP} t ON t.id_lead = COALESCE(l.glide_id, l.id_lead)`
    );
    const [[keep]] = await targetConn.query(
      `SELECT COUNT(*) AS c FROM \`${db}\`.\`lead\` l
       LEFT JOIN ${TMP} t ON t.id_lead = COALESCE(l.glide_id, l.id_lead)
       WHERE t.id_lead IS NULL`
    );

    console.log(`IDs con updated >= since: ${ids.count}`);
    console.log(`  ya en modelo (se rehacen): ${inNorm.c}`);
    console.log(`  resto del modelo (intactos): ${keep.c}\n`);

    if (opts.dryRun) {
      console.log('(dry-run) no se borró ni migró nada');
      return;
    }

    if (!opts.skipDelete) {
      console.log('Paso 1: borrar hijos + lead…');
      const deleted = await deleteCollected(targetConn, db);
      console.log(`  ✓ borrados ${deleted} leads\n`);
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

      console.log('Paso 3: re-migrar…');
      const started = Date.now();
      const result = await remigrateCollected(targetConn, maps, {
        limit: opts.limit,
        onProgress(done, tot) {
          process.stdout.write(`\r  ${done}/${tot} (${((done / tot) * 100).toFixed(1)}%)`);
        },
      });
      console.log(
        `\n  ✓ ${result.migrated}/${result.total} leads — ${((Date.now() - started) / 1000).toFixed(0)}s` +
          (result.afterIdEnd ? ` (hasta idLead ${result.afterIdEnd})` : '')
      );
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
