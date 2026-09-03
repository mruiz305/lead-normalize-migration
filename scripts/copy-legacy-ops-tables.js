#!/usr/bin/env node
/** Copia idéntica prod → TNFG_INTAKE: reportes ops, cron, conflict case, archive duplicados Jun2025 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { closeAll } = require('../src/db');
const { runCopyLegacyOpsTables } = require('../src/steps/copyLegacyOpsTables');

function parseOnlyTables(argv) {
  const idx = argv.indexOf('--only');
  if (idx === -1) return null;
  const names = [];
  for (let i = idx + 1; i < argv.length; i++) {
    if (argv[i].startsWith('--')) break;
    names.push(argv[i]);
  }
  if (!names.length) {
    throw new Error('Usa --only tblLeadConflictCase [otra...]');
  }
  return names;
}

function argNum(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1 || !process.argv[i + 1]) return null;
  return Number(process.argv[i + 1]);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const only = parseOnlyTables(process.argv);
  const skipRecreate = process.argv.includes('--no-recreate');
  const pkMin = argNum('--pk-min');
  const pkMax = argNum('--pk-max');
  console.log(`Legacy ops tables (${dryRun ? 'dry-run' : 'copy'})…\n`);
  await runCopyLegacyOpsTables({
    dryRun,
    only,
    skipRecreate,
    pkMin: Number.isFinite(pkMin) ? pkMin : null,
    pkMax: Number.isFinite(pkMax) ? pkMax : null,
  });
  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
