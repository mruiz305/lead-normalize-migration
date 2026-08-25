#!/usr/bin/env node
/**
 * Compara v_tblLeads (destino) vs tblLeads (origen) para leads migrados.
 * Uso: node scripts/compare-tblLeads.js [--limit N] [--sample] [--id ID]
 */

const config = require('../src/config');
const { withSource, withTarget, closeAll } = require('../src/db');

const BATCH = 500;

/** Columnas excluidas del conteo estricto (no migradas o ruido conocido). */
const NOT_MIGRATED = new Set([
  'funder', 'accessLevel', 'regionLabel', 'regionLable', 'officeKey', 'dou', 'douName', 'LD Sent',
  'Client Name', // duplicado de name; origen suele NULL
  'attyFirm', 'attyContractGroup', // enriquecido desde refAttorneys
]);

const BOOLish = new Set([
  'isMinor', 'boostYN', 'isVIP', 'isHotLead', 'confirmed', 'hasUM', 'isTeleMedicine',
  'requiresTransportation', 'ticketAttorney', 'policeReport', 'drivingRideShare', 'psgInRideShare',
  'fracture', 'ambulance', 'hospital', 'xray', 'mri', 'ctScans', 'isCallBack', 'isCallBackNew',
  'hasPrevAtty', 'isDocuSigni', 'commercialPolicy', 'construction', 'Truck', 'isNewAtty',
  'psngr1IsMinor', 'psngr2IsMinor', 'psngr3IsMinor', 'psngr4IsMinor', 'psngr5IsMinor',
]);

function normStage(v) {
  const s = norm(v);
  if (s === 'Owened') return 'Owned';
  return s;
}

function normField(col, v) {
  if (BOOLish.has(col)) {
    const n = norm(v);
    if (n == null || n === '0' || n === 'false') return null;
    return '1';
  }
  if (col === 'stage') return normStage(v);
  return norm(v);
}

function equalCol(col, a, b) {
  return normField(col, a) === normField(col, b);
}

function passengerPrefix(col) {
  const m = col.match(/^psngr([1-5])(.+)$/);
  return m ? { slot: m[1], rest: m[2] } : null;
}

function skipPassengerField(col, src, dst) {
  const p = passengerPrefix(col);
  if (!p) return false;
  const first = `psngr${p.slot}FirstName`;
  const last = `psngr${p.slot}LastName`;
  const phone = `psngr${p.slot}Phone`;
  const empty = (row) =>
    norm(row[first]) == null && norm(row[last]) == null && norm(row[phone]) == null;
  return empty(src) && empty(dst);
}

function skipPhoneAlt(col, src, dst) {
  if (col !== 'originalPhoneEntry' && col !== 'formattedPhoneEntry') return false;
  return norm(src[col]) == null || norm(src[col]) === norm(src.phone);
}

function norm(v) {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  if (Buffer.isBuffer(v)) return v[0] ? '1' : '0';
  if (typeof v === 'boolean') return v ? '1' : '0';
  const s = String(v).trim();
  if (s === '') return null;
  if (/^\d+\.0+$/.test(s)) return String(parseInt(s, 10));
  if (s === '0' || s === '1') return s;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return s;
}

function equal(a, b) {
  return norm(a) === norm(b);
}

async function getColumns(conn, db, table) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
    [db, table]
  );
  return rows.map((r) => r.COLUMN_NAME);
}

async function fetchIds(limit, singleId) {
  return withTarget(async (conn) => {
    if (singleId) return [Number(singleId)];
    let sql = 'SELECT id_lead FROM `lead` ORDER BY id_lead';
    if (limit) sql += ` LIMIT ${Number(limit)}`;
    const [rows] = await conn.query(sql);
    return rows.map((r) => r.id_lead);
  });
}

async function compareBatch(ids, columns) {
  const colList = columns.map((c) => `\`${c.replace(/`/g, '``')}\``).join(', ');
  const ph = ids.map(() => '?').join(',');

  const [srcRows, dstRows] = await Promise.all([
    withSource((conn) =>
      conn.query(`SELECT ${colList} FROM tblLeads WHERE idLead IN (${ph})`, ids)
    ),
    withTarget((conn) =>
      conn.query(`SELECT ${colList} FROM v_tblLeads WHERE idLead IN (${ph})`, ids)
    ),
  ]);

  const srcById = new Map(srcRows[0].map((r) => [r.idLead, r]));
  const dstById = new Map(dstRows[0].map((r) => [r.idLead, r]));

  const fieldStats = new Map();
  const mismatches = [];
  let perfect = 0;
  let missingSrc = 0;

  for (const id of ids) {
    const src = srcById.get(id);
    const dst = dstById.get(id);
    if (!src) {
      missingSrc++;
      continue;
    }
    if (!dst) {
      mismatches.push({ idLead: id, field: '(row)', src: 'exists', dst: 'MISSING' });
      continue;
    }

    const diffs = [];
    for (const col of columns) {
      if (col === 'idLead' || NOT_MIGRATED.has(col)) continue;
      if (skipPassengerField(col, src, dst)) continue;
      if (skipPhoneAlt(col, src, dst)) continue;

      const s = src[col];
      const d = dst[col];
      if (equalCol(col, s, d)) continue;

      if (!fieldStats.has(col)) {
        fieldStats.set(col, { count: 0 });
      }
      fieldStats.get(col).count++;
      diffs.push({ field: col, src: normField(col, s), dst: normField(col, d) });
    }

    if (diffs.length === 0) perfect++;
    else if (mismatches.length < 30) mismatches.push({ idLead: id, diffs: diffs.slice(0, 8) });
  }

  return { perfect, missingSrc, fieldStats, mismatches, compared: ids.length };
}

async function main() {
  const args = process.argv.slice(2);
  const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : null;
  const singleId = args.includes('--id') ? Number(args[args.indexOf('--id') + 1]) : null;

  console.log('Comparación tblLeads (origen) vs v_tblLeads (destino)');
  console.log(`  Origen:  ${config.source.host}/${config.source.database}`);
  console.log(`  Destino: ${config.target.host}/${config.target.database}\n`);

  const columns = await withSource((c) => getColumns(c, config.source.database, 'tblLeads'));
  const ids = await fetchIds(limit, singleId);
  console.log(`Leads a comparar: ${ids.length}\n`);

  const totals = {
    perfect: 0,
    withDiffs: 0,
    missingSrc: 0,
    fieldStats: new Map(),
    samples: [],
  };

  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const r = await compareBatch(chunk, columns);
    totals.perfect += r.perfect;
    totals.withDiffs += r.compared - r.perfect - r.missingSrc;
    totals.missingSrc += r.missingSrc;
    for (const [k, v] of r.fieldStats) {
      if (!totals.fieldStats.has(k)) totals.fieldStats.set(k, { ...v, count: 0 });
      totals.fieldStats.get(k).count += v.count;
    }
    if (totals.samples.length < 15) totals.samples.push(...r.mismatches);
    process.stdout.write(`\r  ${Math.min(i + BATCH, ids.length)}/${ids.length}`);
  }

  console.log('\n');
  console.log('=== Resultado (comparación ajustada) ===');
  console.log('  Excluye: columnas no migradas, pasajeros vacíos, tel. alt. duplicados,');
  console.log('  booleans 0=NULL, stage Owened→Owned\n');
  console.log(`  Iguales:                   ${totals.perfect}`);
  console.log(`  Con diferencias:           ${totals.withDiffs}`);
  console.log(`  Sin fila en origen:        ${totals.missingSrc}`);

  const sorted = [...totals.fieldStats.entries()]
    .sort((a, b) => b[1].count - a[1].count);

  if (sorted.length) {
    console.log('\n=== Campos que aún difieren ===');
    for (const [col, s] of sorted.slice(0, 25)) {
      console.log(`  ${col.padEnd(28)} ${s.count} leads`);
    }
  }

  if (totals.samples.length) {
    console.log('\n=== Muestras de diferencias ===');
    for (const m of totals.samples.slice(0, 8)) {
      console.log(`\n  idLead ${m.idLead}`);
      for (const d of m.diffs || []) {
        console.log(`    ${d.field}: origen="${d.src}" → destino="${d.dst}"`);
      }
    }
  }

  const pct = ids.length ? ((totals.perfect / ids.length) * 100).toFixed(1) : 0;
  console.log(`\n✓ ${pct}% leads idénticos (comparación ajustada)`);
}

main()
  .catch((e) => {
    console.error('\nError:', e.message);
    process.exit(1);
  })
  .finally(() => closeAll());
