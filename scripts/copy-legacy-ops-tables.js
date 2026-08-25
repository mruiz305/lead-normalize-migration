#!/usr/bin/env node
/** Copia idéntica prod → TNFG_INTAKE: tbl_tmp_all_cases_report, rep_machine_output, tblCron, tblCronConfig, tblLeadConflictCase */

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

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const only = parseOnlyTables(process.argv);
  console.log(`Legacy ops tables (${dryRun ? 'dry-run' : 'copy'})…\n`);
  await runCopyLegacyOpsTables({ dryRun, only });
  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
