#!/usr/bin/env node
/**
 * Backfill entity_log + log_detail + id_log para datos migrados.
 * Uso: npm run backfill:entity-log [-- --table client --limit 1000 --verbose]
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');
const { backfillEntityLog, LOGGED_TABLES } = require('../src/migration/entityLogBackfill');

function parseArgs() {
  const args = process.argv.slice(2);
  const tableIdx = args.indexOf('--table');
  const limitIdx = args.indexOf('--limit');
  const batchIdx = args.indexOf('--batch');
  return {
    table: tableIdx >= 0 ? args[tableIdx + 1] : null,
    limit: limitIdx >= 0 ? Number(args[limitIdx + 1]) : null,
    batchSize: batchIdx >= 0 ? Number(args[batchIdx + 1]) : undefined,
    verbose: args.includes('--verbose'),
    dryRun: args.includes('--dry-run'),
  };
}

async function main() {
  const opts = parseArgs();
  const db = config.target.database;

  console.log(`Backfill entity_log → ${db}`);
  if (opts.table) console.log(`  tabla: ${opts.table}`);
  if (opts.limit) console.log(`  límite: ${opts.limit}`);
  if (opts.dryRun) {
    console.log('\n(dry-run) Tablas con id_log:');
    for (const { table } of LOGGED_TABLES) {
      if (opts.table && opts.table !== table) continue;
      console.log(`  · ${table}`);
    }
    return;
  }

  console.log('');

  await withTarget(async (conn) => {
    const { summary, totals } = await backfillEntityLog(conn, opts);
    const processed = Object.values(summary).reduce((a, b) => a + b, 0);
    console.log(`\nTotal procesado: ${processed.toLocaleString()}`);
    console.log(`entity_log: ${Number(totals.entity_log).toLocaleString()}`);
    console.log(`log_detail: ${Number(totals.log_detail).toLocaleString()}`);
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
