#!/usr/bin/env node
/**
 * Limpieza general + carga desde 0 del modelo normalizado de leads.
 *
 * 1) Refresca staging (tblLeads_src) desde prod
 * 2) TRUNCATE tablas operativas (lead, client, hijos) — no toca catálogos/app_user
 * 3) migrate completo
 * 4) Guarda .sync-state.json para el proceso incremental
 *
 * Uso:
 *   npm run reload:full -- --dry-run
 *   npm run reload:full
 *   npm run reload:full -- --skip-copy     # usa staging actual
 *   npm run reload:full -- --full-copy     # DROP+CREATE tblLeads_src (más lento, más limpio)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { withTarget, withSource, closeAll } = require('../src/db');

const ROOT = path.join(__dirname, '..');
const STATE_FILE = path.join(ROOT, '.sync-state.json');

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    skipCopy: argv.includes('--skip-copy'),
    fullCopy: argv.includes('--full-copy'),
  };
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

function writeState(extra = {}) {
  const state = {
    lastSyncAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    lastFullReloadAt: new Date().toISOString(),
    ...extra,
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
  console.log(`\n✓ estado guardado: ${STATE_FILE}`);
  console.log(`  lastSyncAt=${state.lastSyncAt}`);
  return state;
}

async function printCounts(label) {
  await withTarget(async (conn) => {
    const db = config.target.database;
    const [[lead]] = await conn.query(`SELECT COUNT(*) c, COALESCE(MAX(id_lead),0) maxId FROM \`${db}\`.\`lead\``);
    const [[client]] = await conn.query(`SELECT COUNT(*) c FROM \`${db}\`.client`);
    let src = { c: 0, maxId: 0 };
    try {
      const [[s]] = await conn.query(
        `SELECT COUNT(*) c, COALESCE(MAX(idLead),0) maxId FROM \`${db}\`.tblLeads_src`
      );
      src = s;
    } catch (_) {}
    console.log(`[${label}] lead=${lead.c} (max ${lead.maxId}) · client=${client.c} · staging=${src.c} (max ${src.maxId})`);
  });
  if (config.hasSeparateSource) {
    await withSource(async (conn) => {
      const [[p]] = await conn.query(
        `SELECT COUNT(*) c, COALESCE(MAX(idLead),0) maxId FROM \`${config.source.database}\`.tblLeads`
      );
      console.log(`[${label}] prod tblLeads=${p.c} (max ${p.maxId})`);
    });
  }
}

async function migrateUntilDone() {
  // Una corrida completa; si queda pendiente (crash/parcial), resume en loop
  runNpm('migrate');
  for (let i = 0; i < 50; i++) {
    let pending = 0;
    await withTarget(async (conn) => {
      const db = config.target.database;
      const [[wm]] = await conn.query(
        `SELECT COALESCE(MAX(id_lead),0) AS maxId FROM \`${db}\`.\`lead\``
      );
      const [[p]] = await conn.query(
        `SELECT COUNT(*) AS c FROM \`${db}\`.tblLeads_src WHERE idLead > ?`,
        [wm.maxId]
      );
      pending = Number(p.c);
      console.log(`  check pendientes idLead > ${wm.maxId}: ${pending}`);
    });
    if (pending === 0) return;
    runNpm('migrate:resume');
  }
  throw new Error('Quedaron pendientes tras varios resume');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log('reload:full — limpieza + carga desde 0');
  console.log(`  Destino: ${config.target.host}/${config.target.database}`);
  console.log(`  Modo:    ${opts.dryRun ? 'dry-run' : 'LIVE'}`);
  console.log(`  Staging: ${opts.skipCopy ? 'skip' : opts.fullCopy ? 'full-copy' : 'sync'}\n`);

  await printCounts('antes');

  if (opts.dryRun) {
    console.log('\n(dry-run) pasos que se ejecutarían:');
    if (!opts.skipCopy) {
      console.log(opts.fullCopy ? '  1. npm run copy:tblLeads-src' : '  1. npm run sync:tblLeads-src -- --since (últimos 14 días)');
    }
    console.log('  2. npm run truncate');
    console.log('  3. npm run migrate (+ resume hasta 0 pendientes)');
    console.log('  4. escribir .sync-state.json');
    return;
  }

  if (!opts.skipCopy) {
    if (opts.fullCopy) {
      runNpm('copy:tblLeads-src');
    } else {
      // Ids nuevos + filas tocadas ~2 semanas (staging histórico ya suele estar)
      const d = new Date(Date.now() - 14 * 24 * 3600 * 1000);
      const pad = (n) => String(n).padStart(2, '0');
      const since = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 00:00:00`;
      runNpm('sync:tblLeads-src', ['--since', since]);
    }
  }

  runNpm('truncate');
  await printCounts('post-truncate');

  console.log('\nMigración completa (puede tardar ~1–2 h)…');
  await migrateUntilDone();
  await printCounts('post-migrate');

  writeState({ mode: 'full-reload' });
  console.log('\nListo. De acá en más: npm run sync:incremental');
}

main()
  .catch((e) => {
    console.error('\nError:', e.message || e);
    process.exitCode = 1;
  })
  .finally(() => closeAll());
