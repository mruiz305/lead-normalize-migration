#!/usr/bin/env node
/**
 * Un ciclo operativo prod → TNFG_INTAKE (incremental).
 *
 * Por defecto (vía sync:cron / CronManager como datamart):
 *   1) sync:ref-attorney
 *   2) sync:incremental
 *   3) backfill:attorney-miss
 *   4) sync:lead-comments -- --resume
 *
 * Opcionales: --with-catalogs --with-users --with-legacy-ops
 *             --skip-attorney --skip-leads --skip-comments --skip-backfill
 *
 * Uso:
 *   npm run sync:ops
 *   npm run sync:ops -- --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { spawnSync } = require('child_process');
const path = require('path');
const { formatDuration } = require('../src/utils/timing');

const ROOT = path.join(__dirname, '..');

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    withCatalogs: argv.includes('--with-catalogs'),
    withUsers: argv.includes('--with-users'),
    withLegacyOps: argv.includes('--with-legacy-ops'),
    skipAttorney: argv.includes('--skip-attorney'),
    skipLeads: argv.includes('--skip-leads'),
    skipComments: argv.includes('--skip-comments'),
    skipBackfill: argv.includes('--skip-backfill'),
    since: (() => {
      const i = argv.indexOf('--since');
      return i >= 0 ? argv[i + 1] : null;
    })(),
    hours: (() => {
      const i = argv.indexOf('--hours');
      return i >= 0 ? argv[i + 1] : null;
    })(),
  };
}

function runNpm(script, args = []) {
  const label = `${script}${args.length ? ' ' + args.join(' ') : ''}`;
  console.log(`\n→ npm run ${label}`);
  const t0 = Date.now();
  const r = spawnSync('npm', ['run', script, ...(args.length ? ['--', ...args] : [])], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  const elapsed = Date.now() - t0;
  if (r.status !== 0) {
    console.error(`  ✗ ${label} falló tras ${formatDuration(elapsed)}`);
    throw new Error(`Falló: npm run ${script} (exit ${r.status})`);
  }
  console.log(`  ⏱ ${label}: ${formatDuration(elapsed)}`);
  return elapsed;
}

function plan(opts) {
  const steps = [];
  if (opts.withCatalogs) {
    steps.push({ script: 'copy-catalogs', args: [] });
  } else if (!opts.skipAttorney) {
    steps.push({ script: 'sync:ref-attorney', args: [] });
  }
  if (opts.withUsers) steps.push({ script: 'copy-users', args: [] });
  if (opts.withLegacyOps) steps.push({ script: 'copy:legacy-ops', args: [] });
  if (!opts.skipLeads) {
    const leadArgs = [];
    if (opts.since) leadArgs.push('--since', opts.since);
    if (opts.hours) leadArgs.push('--hours', String(opts.hours));
    steps.push({ script: 'sync:incremental', args: leadArgs });
  }
  if (!opts.skipBackfill) steps.push({ script: 'backfill:attorney-miss', args: [] });
  if (!opts.skipComments) {
    steps.push({ script: 'sync:lead-comments', args: ['--resume'] });
  }
  return steps;
}

async function runSyncOps(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  const steps = plan(opts);

  console.log('sync:ops — ciclo prod → TNFG_INTAKE');
  console.log(`  Modo: ${opts.dryRun ? 'dry-run' : 'LIVE'}`);
  console.log('  Pasos:');
  for (const s of steps) {
    console.log(`    · ${s.script}${s.args.length ? ' ' + s.args.join(' ') : ''}`);
  }

  if (opts.dryRun) {
    console.log('\n(dry-run) no se ejecutó nada');
    return { dryRun: true, timings: [], totalMs: 0 };
  }

  const t0 = Date.now();
  const timings = [];
  for (const s of steps) {
    const ms = runNpm(s.script, s.args);
    timings.push({ step: `${s.script}${s.args.length ? ' ' + s.args.join(' ') : ''}`, ms });
  }
  const totalMs = Date.now() - t0;
  console.log('\n── tiempos ──');
  for (const t of timings) {
    console.log(`  ${formatDuration(t.ms).padStart(8)}  ${t.step}`);
  }
  console.log(`\n✓ sync:ops listo en ${formatDuration(totalMs)}`);
  return { dryRun: false, timings, totalMs };
}

async function main() {
  await runSyncOps(process.argv.slice(2));
}

module.exports = { runSyncOps, parseArgs, plan };

if (require.main === module) {
  main().catch((e) => {
    console.error('\nError:', e.message || e);
    process.exitCode = 1;
  });
}
