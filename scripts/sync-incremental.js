#!/usr/bin/env node
/**
 * Proceso operativo: solo ingresa leads nuevos y re-migra los actualizados.
 *
 * 1) sync staging (tblLeads_src) desde prod
 * 2) remigrate leads con updated >= since (borra+recarga esos ids)
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
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { withTarget, withSource, closeAll } = require('../src/db');

const ROOT = path.join(__dirname, '..');
const STATE_FILE = path.join(ROOT, '.sync-state.json');

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function writeState(prev, sinceUsed) {
  const state = {
    ...(prev || {}),
    lastSyncAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    lastIncrementalAt: new Date().toISOString(),
    lastSinceUsed: sinceUsed,
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
  return state;
}

function hoursAgo(h) {
  const d = new Date(Date.now() - h * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function parseArgs(argv) {
  const sinceIdx = argv.indexOf('--since');
  const hoursIdx = argv.indexOf('--hours');
  return {
    dryRun: argv.includes('--dry-run'),
    skipRemigrate: argv.includes('--skip-remigrate'),
    since: sinceIdx >= 0 ? argv[sinceIdx + 1] : null,
    hours: hoursIdx >= 0 ? Number(argv[hoursIdx + 1]) : null,
  };
}

function resolveSince(opts, state) {
  if (opts.since) return opts.since;
  if (opts.hours && opts.hours > 0) return hoursAgo(opts.hours);
  if (state?.lastSyncAt) return state.lastSyncAt;
  return hoursAgo(24);
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
  const since = resolveSince(opts, state);

  console.log('sync:incremental — nuevos + actualizados');
  console.log(`  Destino: ${config.target.host}/${config.target.database}`);
  console.log(`  since:   ${since}`);
  console.log(`  estado:  ${state ? STATE_FILE : '(sin .sync-state.json → default 24h)'}`);
  console.log(`  Modo:    ${opts.dryRun ? 'dry-run' : 'LIVE'}\n`);

  await preview(since);

  if (opts.dryRun) {
    console.log('\n(dry-run) pasos:');
    console.log(`  1. sync:tblLeads-src -- --since "${since}"`);
    if (!opts.skipRemigrate) console.log(`  2. remigrate:updated -- --since "${since}"`);
    console.log('  3. migrate:resume');
    console.log('  4. actualizar .sync-state.json');
    return;
  }

  runNpm('sync:tblLeads-src', ['--since', since]);

  if (!opts.skipRemigrate) {
    runNpm('remigrate:updated', ['--since', since]);
  } else {
    console.log('\n(skip remigrate updated)');
  }

  runNpm('migrate:resume');

  const next = writeState(state, since);
  console.log(`\n✓ incremental listo · next lastSyncAt=${next.lastSyncAt}`);
}

main()
  .catch((e) => {
    console.error('\nError:', e.message || e);
    process.exitCode = 1;
  })
  .finally(() => closeAll());
