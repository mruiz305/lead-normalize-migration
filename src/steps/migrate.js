const config = require('../config');
const { withTarget, withSource, sourcePool, targetPool } = require('../db');
const { loadCatalogMaps } = require('../migration/maps');
const { populateHierarchyMembership } = require('../migration/hierarchyMembership');
const { syncInsuranceCatalog } = require('../migration/insurance');
const { syncAtFaultTypeCatalog } = require('../migration/atFaultTypeCatalog');
const { seedAccidentLocationTypes } = require('../migration/accidentLocationTypeCatalog');
const { seedSeverityLevels } = require('../migration/severityLevelCatalog');
const { syncInjurySiteCatalog } = require('../migration/injurySiteCatalog');
const { runMigration, getResumeWatermark } = require('../migration/pipeline');
const { syncLeadStatusEvents } = require('../migration/leadStatusEvent');

const BATCH_SIZE = Number(process.env.MIG_BATCH_SIZE || 200);

function parseFlag(args, flag) {
  const idx = args.indexOf(flag);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith('--')) {
    return args[idx + 1];
  }
  return null;
}

function parseLimit(args) {
  const fromArg = parseFlag(args, '--limit');
  if (fromArg) {
    const n = Number(fromArg);
    if (n > 0) return n;
  }
  const env = Number(process.env.MIG_LIMIT || 0);
  return env > 0 ? env : null;
}

function parseMigrateOptions(args) {
  return {
    limit: parseLimit(args),
    resume: args.includes('--resume') || process.env.MIG_RESUME === '1',
    fromId: (() => {
      const v = parseFlag(args, '--from-id');
      return v != null ? Number(v) : null;
    })(),
  };
}

async function assertSourceAvailable() {
  const { database, table, onTarget } = config.sourceLeads;
  if (onTarget) {
    await withTarget(async (conn) => {
      const [rows] = await conn.query(
        `SELECT TABLE_TYPE FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
        [database, table]
      );
      if (!rows.length) {
        throw new Error(
          `${table} no existe en destino (${database}). Ejecuta: npm run copy:tblLeads-src`
        );
      }
      if (String(rows[0].TABLE_TYPE).toUpperCase() === 'VIEW') {
        throw new Error(
          `${database}.${table} es una VISTA. La copia debe ser tabla (tblLeads_src).`
        );
      }
    });
    return;
  }
  await withSource(async (conn) => {
    const [rows] = await conn.query(
      `SELECT 1 FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tblLeads' LIMIT 1`,
      [config.source.database]
    );
    if (!rows.length) {
      throw new Error(`tblLeads no existe en origen (${config.source.database})`);
    }
  });
}

async function assertTargetReady({ resume = false } = {}) {
  await withTarget(async (conn) => {
    const db = config.target.database;
    const [rows] = await conn.query(
      `SELECT 1 FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'lead' LIMIT 1`,
      [db]
    );
    if (!rows.length) {
      throw new Error('Ejecuta bootstrap antes de migrate');
    }
    const [[{ userCount }]] = await conn.query(
      `SELECT COUNT(*) AS userCount FROM \`${db}\`.app_user`
    );
    if (Number(userCount) === 0) {
      throw new Error('app_user vacío. Ejecuta: npm run copy-users');
    }
    const [[{ c }]] = await conn.query(
      `SELECT COUNT(*) AS c FROM \`${db}\`.\`lead\``
    );
    if (Number(c) > 0 && !resume) {
      throw new Error(
        `Destino ya tiene ${c} leads. Usa --resume para continuar o: npm run truncate`
      );
    }
  });
}

async function runMigrate({ dryRun = false, limit = null, resume = false, fromId = null } = {}) {
  const effectiveLimit = limit ?? (Number(process.env.MIG_LIMIT || 0) || null);
  const incremental = resume || fromId != null;

  console.log('Migrate v2: transformación tblLeads → modelo de dominio');
  console.log(`  Origen catálogos:  ${config.source.host}/${config.source.database} (solo lectura)`);
  console.log(`  Origen leads:      ${config.sourceLeads.sql}${config.sourceLeads.onTarget ? ' (copia local)' : ''}`);
  console.log(`  Destino: ${config.target.host}/${config.target.database}`);
  console.log(`  Lote:    ${BATCH_SIZE} filas`);
  if (incremental) {
    console.log(`  Modo:    incremental${resume ? ' (--resume)' : ''}${fromId != null ? ` desde idLead Glide > ${fromId}` : ''}`);
  }
  if (effectiveLimit) {
    console.log(`  Límite:  ${effectiveLimit} leads en esta corrida`);
  }
  console.log('');

  await assertSourceAvailable();
  await assertTargetReady({ resume: incremental });

  if (dryRun) {
    await withTarget(async (conn) => {
      const watermark = incremental ? await getResumeWatermark(conn) : 0;
      const startId = fromId != null ? fromId : watermark;
      if (config.sourceLeads.onTarget) {
        const [[{ pending }]] = await conn.query(
          `SELECT COUNT(*) AS pending FROM ${config.sourceLeads.sql} WHERE idLead > ?`,
          [startId]
        );
        const take = effectiveLimit ? Math.min(effectiveLimit, pending) : pending;
        console.log(`  (dry-run) Pendientes: ${pending} (idLead > ${startId})`);
        console.log(`  (dry-run) Esta corrida migraría: ${take} leads`);
        return;
      }
      await withSource(async (srcConn) => {
        const [[{ pending }]] = await srcConn.query(
          `SELECT COUNT(*) AS pending FROM ${config.sourceLeads.sql} WHERE idLead > ?`,
          [startId]
        );
        const take = effectiveLimit ? Math.min(effectiveLimit, pending) : pending;
        console.log(`  (dry-run) Pendientes: ${pending} (idLead > ${startId})`);
        console.log(`  (dry-run) Esta corrida migraría: ${take} leads`);
      });
    });
    return;
  }

  const sourceConn = await sourcePool.getConnection();
  const targetConn = await targetPool.getConnection();
  try {
    const resumeAfterId = incremental
      ? (fromId != null ? Number(fromId) : await getResumeWatermark(targetConn))
      : 0;

    console.log('Paso 1: hierarchy_membership (g_users + catálogo oficinas)…');
    await populateHierarchyMembership(sourceConn, targetConn, { truncate: true });

    console.log('Paso 2: ref_insurance_carrier (refInsurance prod → PIP + AT_FAULT)…');
    if (incremental && resumeAfterId > 0) {
      console.log(`  (solo idLead Glide > ${resumeAfterId}; watermark=MAX(glide_id))`);
    }
    await syncInsuranceCatalog(sourceConn, targetConn, {
      truncate: !incremental,
      afterId: resumeAfterId,
    });

    console.log('Paso 2b: catálogos accidente (location + at-fault type)…');
    await seedAccidentLocationTypes(targetConn);
    await syncAtFaultTypeCatalog(sourceConn, targetConn, {
      truncate: !incremental,
    });
    await seedSeverityLevels(targetConn);
    await syncInjurySiteCatalog(sourceConn, targetConn, {
      truncate: !incremental,
    });

    console.log('Paso 3: cargar catálogos destino…');
    const maps = await loadCatalogMaps(targetConn);
    console.log(
      `  ref_attorney: ${maps.attorneyByName.size}, ref_tx_location: ${maps.txByName.size}, ` +
        `offices: ${maps.companyOfficeByCode.size}, carriers: ${maps.carrierByKey.size}, app_user: ${maps.userByEmail.size}`
    );

    if (maps.attorneyByName.size === 0 || maps.txByName.size === 0) {
      console.warn('  ⚠ ref_attorney o ref_tx_location vacíos — ejecuta: npm run copy-catalogs');
    }
    if (maps.userByEmail.size === 0) {
      console.warn('  ⚠ app_user vacío — ejecuta: npm run copy-users');
    }

    if (incremental) {
      console.log(`  Punto de continuación: idLead > ${fromId ?? resumeAfterId}`);
    }

    console.log('Paso 4: transformar leads…');
    const started = Date.now();
    const result = await runMigration(sourceConn, targetConn, maps, {
      batchSize: BATCH_SIZE,
      limit: effectiveLimit,
      resume: incremental,
      fromId,
      onProgress(done, tot) {
        const pct = ((done / tot) * 100).toFixed(1);
        process.stdout.write(`\r  ${done}/${tot} (${pct}%)`);
      },
    });

    const [[{ destTotal }]] = await targetConn.query(
      `SELECT COUNT(*) AS destTotal FROM \`${config.target.database}\`.\`lead\``
    );
    const remaining = Math.max(0, result.pendingTotal - result.migrated);

    console.log(
      `\n  ✓ ${result.migrated}/${result.total} leads en esta corrida` +
        ` (idLead ${result.afterId} → ${result.afterIdEnd})` +
        ` — ${((Date.now() - started) / 1000).toFixed(0)}s`
    );
    console.log(
      `  Total destino: ${destTotal}/${result.sourceTotal} · Pendientes origen: ${remaining}` +
        (remaining > 0 ? ' — ejecuta de nuevo con --resume' : ' · migración completa')
    );

    if (destTotal > 0 && process.env.SYNC_LEAD_STATUS === '1') {
      console.log('Paso 5: histórico de estados (lead_status_event)…');
      await syncLeadStatusEvents(sourceConn, targetConn, maps, { truncate: !incremental });
    } else if (destTotal > 0) {
      console.log('  Histórico estados: npm run sync:lead-status (post-migración)');
    }
  } finally {
    sourceConn.release();
    targetConn.release();
  }
}

module.exports = { runMigrate, parseLimit, parseMigrateOptions };
