#!/usr/bin/env node
/**
 * Copia paralela por rangos de PK (útil para tblLeadsAuditBuffer con JSON pesado).
 *
 *   node scripts/copy-legacy-ops-parallel.js --only tblLeadsAuditBuffer --workers 8
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { spawn } = require('child_process');
const path = require('path');
const config = require('../src/config');
const { withSource, withTarget, closeAll } = require('../src/db');
const {
  recreateTableFromSource,
  LEGACY_OPS_TABLES,
} = require('../src/steps/copyLegacyOpsTables');

function argValue(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  if (i === -1 || !process.argv[i + 1]) return fallback;
  return process.argv[i + 1];
}

async function main() {
  const table = argValue('--only');
  const workers = Math.max(1, Number(argValue('--workers', '8')));
  const jsonBatch = argValue('--json-batch', process.env.MIG_LEGACY_OPS_JSON_BATCH || '300');

  if (!table || !LEGACY_OPS_TABLES.includes(table)) {
    throw new Error(`Usa --only <tabla> (permitidas: ${LEGACY_OPS_TABLES.join(', ')})`);
  }

  console.log(`Parallel copy ${table} × ${workers} workers (json-batch ${jsonBatch})\n`);

  let minId;
  let maxId;
  await withSource(async (sourceConn) => {
    const src = config.source.database;
    const [[row]] = await sourceConn.query(
      `SELECT MIN(id) AS minId, MAX(id) AS maxId FROM \`${src}\`.\`${table}\``,
    );
    minId = Number(row.minId);
    maxId = Number(row.maxId);
  });

  if (!Number.isFinite(minId) || !Number.isFinite(maxId)) {
    throw new Error(`${table}: sin filas en origen`);
  }

  await withTarget(async (targetConn) => {
    await withSource(async (sourceConn) => {
      console.log(`Recreate ${table} (min=${minId} max=${maxId})…`);
      await recreateTableFromSource(sourceConn, targetConn, table);
      await targetConn.query('SET FOREIGN_KEY_CHECKS = 1');
    });
  });

  const span = maxId - minId + 1;
  const chunk = Math.ceil(span / workers);
  const script = path.join(__dirname, 'copy-legacy-ops-tables.js');
  const children = [];

  for (let w = 0; w < workers; w++) {
    const pkMin = minId + w * chunk;
    const pkMax = Math.min(maxId, pkMin + chunk - 1);
    if (pkMin > maxId) break;

    const args = [
      script,
      '--only',
      table,
      '--no-recreate',
      '--pk-min',
      String(pkMin),
      '--pk-max',
      String(pkMax),
    ];
    console.log(`  worker ${w + 1}: PK ${pkMin}..${pkMax}`);
    const child = spawn(process.execPath, args, {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        MIG_LEGACY_OPS_JSON_BATCH: String(jsonBatch),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (buf) => {
      process.stdout.write(`[w${w + 1}] ${buf}`);
    });
    child.stderr.on('data', (buf) => {
      process.stderr.write(`[w${w + 1}] ${buf}`);
    });
    children.push(
      new Promise((resolve, reject) => {
        child.on('exit', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`worker ${w + 1} exit ${code}`));
        });
      }),
    );
  }

  await Promise.all(children);
  await closeAll();
  console.log('\nListo (parallel).');
}

main().catch(async (e) => {
  console.error(e);
  try {
    await closeAll();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
