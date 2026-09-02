#!/usr/bin/env node
/**
 * Auditoría prod tblLeads vs TNFG_INTAKE (conteos + valores clave).
 *
 * Uso:
 *   npm run audit:prod-norm
 *   npm run audit:prod-norm -- --month 2026-07
 *   npm run audit:prod-norm -- --sample 500
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const config = require('../src/config');
const { withSource, withTarget, closeAll } = require('../src/db');

function parseArgs(argv) {
  const monthIdx = argv.indexOf('--month');
  const sampleIdx = argv.indexOf('--sample');
  const hoursIdx = argv.indexOf('--hours');
  return {
    month: monthIdx >= 0 ? argv[monthIdx + 1] : null,
    sample: sampleIdx >= 0 ? Number(argv[sampleIdx + 1]) : null,
    hours: hoursIdx >= 0 ? Number(argv[hoursIdx + 1]) : 72,
  };
}

function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { start, end: next, label: ym };
}

const normDate = (v) => (v ? new Date(v).toISOString().slice(0, 19) : null);
const normStr = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim());

async function countAudit() {
  const srcDb = config.source.database;
  const tgtDb = config.target.database;

  let prodCount = 0;
  let prodMax = 0;
  await withSource(async (c) => {
    const [[r]] = await c.query(`SELECT COUNT(*) c, MAX(idLead) m FROM \`${srcDb}\`.tblLeads`);
    prodCount = r.c;
    prodMax = r.m;
  });

  let stagingCount = 0;
  let leadCount = 0;
  let leadMax = 0;
  let leadMaxGlide = 0;
  let stagingNotMigrated = 0;
  await withTarget(async (c) => {
    const [[s]] = await c.query(`SELECT COUNT(*) c FROM \`${tgtDb}\`.tblLeads_src`);
    const [[l]] = await c.query(
      `SELECT COUNT(*) c, MAX(id_lead) m, MAX(glide_id) mg FROM \`${tgtDb}\`.\`lead\``
    );
    const [[miss]] = await c.query(`
      SELECT COUNT(*) c FROM \`${tgtDb}\`.tblLeads_src src
      LEFT JOIN \`${tgtDb}\`.\`lead\` l ON COALESCE(l.glide_id, l.id_lead) = src.idLead
      WHERE l.id_lead IS NULL
    `);
    stagingCount = s.c;
    leadCount = l.c;
    leadMax = l.m;
    leadMaxGlide = l.mg;
    stagingNotMigrated = miss.c;
  });

  console.log('=== Conteos ===');
  console.log(`  prod tblLeads:     ${prodCount} (max ${prodMax})`);
  console.log(`  staging:           ${stagingCount}`);
  console.log(`  lead (norm):       ${leadCount} (max id_lead ${leadMax}, max glide_id ${leadMaxGlide})`);
  console.log(`  prod - lead:       ${prodCount - leadCount}`);
  console.log(`  staging sin lead:  ${stagingNotMigrated}`);

  await withTarget(async (c) => {
    const [rej] = await c.query(`
      SELECT field_name, reject_reason, COUNT(*) c
      FROM \`${tgtDb}\`.import_reject
      GROUP BY field_name, reject_reason ORDER BY c DESC LIMIT 10
    `);
    console.log('\n=== import_reject (top) ===');
    for (const r of rej) {
      console.log(`  ${r.field_name}/${r.reject_reason}: ${r.c}`);
    }
  });
}

async function valueAudit(range, sampleLimit) {
  const srcDb = config.source.database;
  const tgtDb = config.target.database;

  let idList = []; // glide keys (prod idLead)
  await withTarget(async (c) => {
    let sql = `SELECT COALESCE(l.glide_id, l.id_lead) AS glide_key, l.id_lead
               FROM \`${tgtDb}\`.\`lead\` l`;
    const params = [];
    if (range) {
      sql += ` JOIN lead_timeline lt ON lt.id_lead = l.id_lead
               WHERE lt.date_locked_down >= ? AND lt.date_locked_down < ?`;
      params.push(range.start, range.end);
    }
    sql += ' ORDER BY glide_key';
    if (sampleLimit) sql += ` LIMIT ${sampleLimit}`;
    const [rows] = await c.query(sql, params);
    idList = rows.map((r) => ({ glideKey: Number(r.glide_key), idLead: Number(r.id_lead) }));
  });

  const label = range ? `LD ${range.label}` : sampleLimit ? `sample ${sampleLimit}` : 'all';
  console.log(`\n=== Valores (${label}, n=${idList.length}) ===`);

  const mm = {
    ld: 0,
    appt: 0,
    attorney: 0,
    tx: 0,
    status: 0,
    stale: 0,
    missingProd: 0,
  };
  const attorneySamples = [];
  const statusSamples = [];
  const BATCH = 2000;

  for (let i = 0; i < idList.length; i += BATCH) {
    const chunk = idList.slice(i, i + BATCH);
    const glideKeys = chunk.map((r) => r.glideKey);
    const localIds = chunk.map((r) => r.idLead);
    const phG = glideKeys.map(() => '?').join(',');
    const phL = localIds.map(() => '?').join(',');

    const [prodRows] = await withSource((c) =>
      c.query(
        `SELECT idLead, dateLockedDown, appointmentDateTime, attorney, txLocation, leadStatus, updated
         FROM \`${srcDb}\`.tblLeads WHERE idLead IN (${phG})`,
        glideKeys
      )
    );
    const [normRows] = await withTarget((c) =>
      c.query(
        `SELECT l.id_lead, COALESCE(l.glide_id, l.id_lead) AS glide_key,
          lt.date_locked_down, lc.appointment_at,
          ra.display_name AS attorney, rtl.display_name AS txLocation,
          rls.leadStatus, l.updated_at
         FROM \`${tgtDb}\`.\`lead\` l
         LEFT JOIN lead_timeline lt ON lt.id_lead = l.id_lead
         LEFT JOIN lead_clinical lc ON lc.id_lead = l.id_lead
         LEFT JOIN lead_legal ll ON ll.id_lead = l.id_lead
         LEFT JOIN ref_attorney ra ON ra.id_attorney = ll.id_attorney
         LEFT JOIN ref_tx_location rtl ON rtl.id_tx_location = lc.id_tx_location
         LEFT JOIN refLeadStatus rls ON rls.idLeadStatus = l.id_lead_status
         WHERE l.id_lead IN (${phL})`,
        localIds
      )
    );

    const prodMap = new Map(prodRows.map((r) => [Number(r.idLead), r]));
    const normMap = new Map(normRows.map((r) => [Number(r.glide_key), r]));

    for (const { glideKey } of chunk) {
      const p = prodMap.get(glideKey);
      const n = normMap.get(glideKey);
      if (!p) {
        mm.missingProd++;
        continue;
      }
      if (!n) continue;

      if (normDate(p.dateLockedDown) !== normDate(n.date_locked_down)) mm.ld++;
      if (normDate(p.appointmentDateTime) !== normDate(n.appointment_at)) mm.appt++;
      if (normStr(p.attorney)?.toLowerCase() !== normStr(n.attorney)?.toLowerCase()) {
        mm.attorney++;
        if (attorneySamples.length < 5) {
          attorneySamples.push({ id: glideKey, prod: p.attorney, norm: n.attorney });
        }
      }
      if (normStr(p.txLocation)?.toLowerCase() !== normStr(n.txLocation)?.toLowerCase()) mm.tx++;
      if (normStr(p.leadStatus) !== normStr(n.leadStatus)) {
        mm.status++;
        if (statusSamples.length < 10) {
          statusSamples.push({
            glide_id: glideKey,
            id_lead: n.id_lead,
            prod: p.leadStatus,
            norm: n.leadStatus,
            prodUpdated: p.updated,
            normUpdated: n.updated_at,
          });
        }
      }
      if (p.updated && n.updated_at && new Date(p.updated) > new Date(n.updated_at)) mm.stale++;
    }
  }

  console.log('  Mismatches:', mm);
  if (attorneySamples.length) {
    console.log('  Attorney samples:', attorneySamples);
  }
  if (statusSamples.length) {
    console.log('  Status samples (prod vs norm):');
    for (const s of statusSamples) {
      console.log(
        `    glide=${s.glide_id} local=${s.id_lead} | prod="${s.prod}" norm="${s.norm}" | prod.upd=${s.prodUpdated} norm.upd=${s.normUpdated}`
      );
    }
  }
  if (mm.ld + mm.appt + mm.attorney + mm.tx + mm.status === 0 && mm.stale === 0) {
    console.log('  ✓ Valores alineados con prod');
  } else if (mm.stale > 0) {
    console.log(`  · ${mm.stale} leads con prod.updated > norm (correr sync:ops / remigrate:updated)`);
  }
}

/** Leads tocados en prod recientemente: ¿estado ya refleja en norm? */
async function recentStatusAudit(hours = 72) {
  const srcDb = config.source.database;
  const tgtDb = config.target.database;
  console.log(`\n=== Estados recientes (prod.updated últimas ${hours}h) ===`);

  const [prodRows] = await withSource((c) =>
    c.query(
      `SELECT idLead, leadStatus, updated
       FROM \`${srcDb}\`.tblLeads
       WHERE updated >= DATE_SUB(NOW(), INTERVAL ? HOUR)
       ORDER BY updated DESC`,
      [hours]
    )
  );
  console.log(`  prod actualizados: ${prodRows.length}`);
  if (!prodRows.length) return;

  let match = 0;
  let mismatch = 0;
  let missing = 0;
  const samples = [];
  const BATCH = 2000;

  for (let i = 0; i < prodRows.length; i += BATCH) {
    const chunk = prodRows.slice(i, i + BATCH);
    const ids = chunk.map((r) => r.idLead);
    const ph = ids.map(() => '?').join(',');
    const [normRows] = await withTarget((c) =>
      c.query(
        `SELECT COALESCE(l.glide_id, l.id_lead) AS glide_key, l.id_lead,
                rls.leadStatus, l.updated_at
         FROM \`${tgtDb}\`.\`lead\` l
         LEFT JOIN refLeadStatus rls ON rls.idLeadStatus = l.id_lead_status
         WHERE COALESCE(l.glide_id, l.id_lead) IN (${ph})`,
        ids
      )
    );
    const normMap = new Map(normRows.map((r) => [Number(r.glide_key), r]));
    for (const p of chunk) {
      const n = normMap.get(Number(p.idLead));
      if (!n) {
        missing++;
        continue;
      }
      if (normStr(p.leadStatus) === normStr(n.leadStatus)) match++;
      else {
        mismatch++;
        if (samples.length < 15) {
          samples.push({
            glide_id: p.idLead,
            id_lead: n.id_lead,
            prod: p.leadStatus,
            norm: n.leadStatus,
            prodUpdated: p.updated,
            normUpdated: n.updated_at,
          });
        }
      }
    }
  }

  console.log(`  status OK: ${match}  mismatch: ${mismatch}  sin fila en norm: ${missing}`);
  if (samples.length) {
    console.log('  samples mismatch:');
    for (const s of samples) {
      console.log(
        `    glide=${s.glide_id} local=${s.id_lead} | "${s.prod}" → norm "${s.norm}" | prod.upd=${s.prodUpdated}`
      );
    }
  } else if (mismatch === 0 && missing === 0) {
    console.log('  ✓ Estados recientes alineados');
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const range = opts.month ? monthRange(opts.month) : null;

  console.log('audit:prod-norm');
  console.log(`  prod:  ${config.source.host}/${config.source.database}`);
  console.log(`  norm:  ${config.target.host}/${config.target.database}\n`);

  await countAudit();
  await valueAudit(range, opts.sample);
  await recentStatusAudit(opts.hours);

  if (range) {
    const srcDb = config.source.database;
    const tgtDb = config.target.database;
    let prodAppt = 0;
    let normAppt = 0;
    await withSource(async (c) => {
      const [[r]] = await c.query(
        `SELECT COUNT(*) c FROM \`${srcDb}\`.tblLeads
         WHERE dateLockedDown >= ? AND dateLockedDown < ?
           AND appointmentDateTime IS NOT NULL`,
        [range.start, range.end]
      );
      prodAppt = r.c;
    });
    await withTarget(async (c) => {
      const [[r]] = await c.query(
        `SELECT COUNT(*) c FROM \`${tgtDb}\`.\`lead\` l
         JOIN lead_timeline lt ON lt.id_lead = l.id_lead
         JOIN lead_clinical lc ON lc.id_lead = l.id_lead
         WHERE lt.date_locked_down >= ? AND lt.date_locked_down < ?
           AND lc.appointment_at IS NOT NULL`,
        [range.start, range.end]
      );
      normAppt = r.c;
    });
    console.log(`\n=== ${range.label} LD + cita ===`);
    console.log(`  prod: ${prodAppt}  norm: ${normAppt}  delta: ${normAppt - prodAppt}`);
  }
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
  })
  .finally(() => closeAll());
