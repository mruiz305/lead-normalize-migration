#!/usr/bin/env node
/**
 * Proceso operativo: solo ingresa leads nuevos y re-migra los actualizados.
 *
 * 1) sync staging (tblLeads_src) desde prod
 * 2) remigrate leads con updated >= since (UPDATE lead + hijos)
 * 3) migrate --resume (ids nuevos por si quedó alguno fuera del filtro updated)
 * 4) actualiza .sync-state.json
 *
 * Uso:
 *   npm run sync:incremental -- --dry-run
 *   npm run sync:incremental
 *   npm run sync:incremental -- --since "2026-08-20 00:00:00"
 *   npm run sync:incremental -- --hours 24
 *
 * since por defecto: lastSyncAt de .sync-state.json, o hace 24 h.
 *
 * Todas las fechas van en el reloj de prod, no en el de esta máquina: `updated`
 * de tblLeads se guarda en la zona de dbProduction y tblLeads_src copia ese
 * valor tal cual, así que un since tomado del reloj local queda corrido tantas
 * horas como diferencia haya y el filtro deja de matchear.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { withTarget, withSource, closeAll } = require('../src/db');

const ROOT = path.join(__dirname, '..');
const STATE_FILE = path.join(ROOT, '.sync-state.json');

/**
 * Solapamiento mínimo hacia atrás. Hace dos cosas: no perder lo que cambió
 * mientras corría el sync anterior, y fijar el techo del since para que nunca
 * apunte al futuro de prod. Reprocesar de más es barato — el sync es
 * idempotente — y perder un cambio no se nota hasta mucho después.
 */
const OVERLAP_MINUTES = Number(process.env.MIG_SYNC_OVERLAP_MINUTES || 10);

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function writeState(prev, sinceUsed, startedAtOnSource) {
  const state = {
    ...(prev || {}),
    // Reloj de prod y tomado al inicio: lo que cambie durante la corrida entra
    // en la siguiente en vez de caer en el hueco entre ambas.
    lastSyncAt: startedAtOnSource,
    lastSyncClock: 'source',
    lastIncrementalAt: new Date().toISOString(),
    lastSinceUsed: sinceUsed,
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
  return state;
}

function fmtSql(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function minusMinutes(d, minutes) {
  return new Date(d.getTime() - minutes * 60000);
}

/** NOW() de dbProduction, que es el reloj en el que están escritos los `updated`. */
async function sourceNow() {
  let now;
  await withSource(async (conn) => {
    const [[r]] = await conn.query('SELECT NOW() AS n');
    now = new Date(r.n);
  });
  return now;
}

function parseArgs(argv) {
  const sinceIdx = argv.indexOf('--since');
  const hoursIdx = argv.indexOf('--hours');
  return {
    dryRun: argv.includes('--dry-run'),
    skipRemigrate: argv.includes('--skip-remigrate'),
    skipPrune: argv.includes('--skip-prune'),
    since: sinceIdx >= 0 ? argv[sinceIdx + 1] : null,
    hours: hoursIdx >= 0 ? Number(argv[hoursIdx + 1]) : null,
  };
}

function resolveSince(opts, state, nowOnSource) {
  if (opts.since) return opts.since;

  const candidate = opts.hours && opts.hours > 0
    ? fmtSql(minusMinutes(nowOnSource, opts.hours * 60))
    : state?.lastSyncAt || fmtSql(minusMinutes(nowOnSource, 24 * 60));

  // Techo: el since nunca puede quedar adelante del reloj de prod. Además de
  // cubrir el desfase de zona, esto sanea solo un .sync-state.json viejo que
  // haya quedado guardado en otro reloj — si no, el filtro no matchea nada y
  // los cambios se pierden en silencio, corrida tras corrida.
  const ceiling = fmtSql(minusMinutes(nowOnSource, OVERLAP_MINUTES));
  return candidate < ceiling ? candidate : ceiling;
}

function runNpm(script, args = []) {
  console.log(`\n→ npm run ${script}${args.length ? ' -- ' + args.join(' ') : ''}`);
  const r = spawnSync('npm', ['run', script, ...(args.length ? ['--', ...args] : [])], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0) {
    throw new Error(`Falló: npm run ${script} (exit ${r.status})`);
  }
}

async function preview(since) {
  const db = config.target.database;
  await withSource(async (conn) => {
    const [[p]] = await conn.query(
      `SELECT COUNT(*) AS updatedOrNew FROM \`${config.source.database}\`.tblLeads WHERE updated >= ?`,
      [since]
    );
    console.log(`  prod updated>=since: ${p.updatedOrNew}`);
  });
  await withTarget(async (conn) => {
    const [[wm]] = await conn.query(
      `SELECT COALESCE(MAX(id_lead),0) maxId,
              COALESCE(MAX(glide_id),0) maxGlide,
              COUNT(*) c
       FROM \`${db}\`.\`lead\``
    );
    console.log(`  modelo actual: ${wm.c} leads (max id_lead ${wm.maxId}, max glide_id ${wm.maxGlide})`);
    try {
      const [[n]] = await conn.query(
        `SELECT COUNT(*) c FROM \`${db}\`.tblLeads_src WHERE idLead > ?`,
        [wm.maxGlide]
      );
      console.log(`  staging ids Glide nuevos (>max glide_id): ${n.c}`);
    } catch (_) {}
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const state = readState();
  const nowOnSource = await sourceNow();
  const startedAt = fmtSql(nowOnSource);
  const since = resolveSince(opts, state, nowOnSource);

  console.log('sync:incremental — nuevos + actualizados');
  console.log(`  Destino: ${config.target.host}/${config.target.database}`);
  console.log(`  reloj:   ${startedAt} (${config.source.host}/${config.source.database})`);
  console.log(`  since:   ${since}`);
  console.log(`  estado:  ${state ? STATE_FILE : '(sin .sync-state.json → default 24h)'}`);
  console.log(`  Modo:    ${opts.dryRun ? 'dry-run' : 'LIVE'}\n`);

  await preview(since);

  if (opts.dryRun) {
    console.log('\n(dry-run) pasos:');
    console.log(`  1. sync:tblLeads-src -- --since "${since}"`);
    if (!opts.skipPrune) console.log('  2. prune:leads-orphans  (IDs que ya no están en prod.tblLeads)');
    if (!opts.skipRemigrate) console.log(`  3. remigrate:updated -- --since "${since}"`);
    console.log('  4. migrate:resume --skip-hierarchy');
    console.log('  5. actualizar .sync-state.json');
    return;
  }

  runNpm('sync:tblLeads-src', ['--since', since]);
  if (!opts.skipPrune) {
    runNpm('prune:leads-orphans');
  } else {
    console.log('\n(skip prune orphans)');
  }

  if (!opts.skipRemigrate) {
    runNpm('remigrate:updated', ['--since', since]);
  } else {
    console.log('\n(skip remigrate updated)');
  }

  runNpm('migrate:resume', ['--skip-hierarchy']);

  const next = writeState(state, since, startedAt);
  console.log(`\n✓ incremental listo · next lastSyncAt=${next.lastSyncAt}`);
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error('\nError:', e.message || e);
      process.exitCode = 1;
    })
    .finally(() => closeAll());
}

module.exports = { resolveSince, fmtSql, minusMinutes, OVERLAP_MINUTES };
