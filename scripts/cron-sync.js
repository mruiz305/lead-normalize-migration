#!/usr/bin/env node
/**
 * Cron del sync intake — mismo patrón que tnfg-datamart-etl/src/etl/cronEtl.js:
 *  1) corre un ciclo al arrancar
 *  2) CronManager lee tblCronConfig/tblCron (origen) y reprograma
 *  3) poll cada 30s por si cambia la expression en BD
 *
 * Env:
 *   PROCESS_NAME_INTAKE_SYNC  = tblCronConfig.script_code (default TNFG_INTAKE_SYNC)
 *   CRON_WATCH_INTERVAL_MS    default 30000 (relee expression desde BD)
 *
 * Schedule: solo tblCron / tblCronConfig en origen (como datamart ETL).
 *
 * Uso:
 *   npm run sync:cron
 *   npm run sync:daemon   (alias)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const CronManager = require('../src/utils/cronManager');
const { formatDuration } = require('../src/utils/timing');
const { runSyncOps } = require('./sync-ops');

const PROCESS_NAME =
  process.env.PROCESS_NAME_INTAKE_SYNC || process.env.PROCESS_NAME_ETL_INTAKE || 'TNFG_INTAKE_SYNC';

let running = false;

async function job() {
  if (running) {
    console.warn(`[${new Date().toISOString()}] sync ya en curso — skip overlap`);
    return;
  }
  running = true;
  const t0 = Date.now();
  try {
    await runSyncOps(process.argv.slice(2).filter((a) => a !== '--once'));
    console.log(
      `[${new Date().toISOString()}] Intake sync run complete (${formatDuration(Date.now() - t0)}).`
    );
  } catch (err) {
    console.error(
      `Error durante cron intake sync (${formatDuration(Date.now() - t0)}):`,
      err.message || err
    );
  } finally {
    running = false;
  }
}

(async () => {
  const once = process.argv.includes('--once');

  console.log(
    `[CRON] Intake sync (script_code=${PROCESS_NAME})… ${new Date().toISOString()}`
  );

  try {
    await job();
    console.log('✔ Primera corrida intake sync completa.');
  } catch (err) {
    console.error('Error en primera corrida intake sync:', err);
  }

  if (once) {
    process.exit(process.exitCode || 0);
    return;
  }

  const mgr = new CronManager(PROCESS_NAME, job, {
    watchInterval: Number(process.env.CRON_WATCH_INTERVAL_MS) || 30_000,
  });

  await mgr.start();

  console.log(`Watching cron config for "${PROCESS_NAME}" every ${mgr.watchInterval / 1000}s`);

  const shutdown = (sig) => {
    console.log(`\n${sig} — deteniendo CronManager…`);
    mgr.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
})();
