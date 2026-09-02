#!/usr/bin/env node

const config = require('./config');
const { closeAll } = require('./db');
const { runStatus } = require('./steps/status');
const { runBootstrap } = require('./steps/bootstrap');
const { runCopyCatalogs } = require('./steps/copyCatalogs');
const { runCopyUsers } = require('./steps/copyUsers');
const { runTruncate } = require('./steps/truncate');
const { runMigrate, parseMigrateOptions } = require('./steps/migrate');
const { runValidate } = require('./steps/validate');
const { runApplyViews } = require('./steps/applyViews');

const STEPS = {
  status: runStatus,
  bootstrap: runBootstrap,
  'copy-catalogs': runCopyCatalogs,
  'copy-users': runCopyUsers,
  truncate: runTruncate,
  migrate: runMigrate,
  validate: runValidate,
  'apply-views': runApplyViews,
};

function usage() {
  console.log(`Uso: node src/run.js <paso> [--dry-run] [--limit N] [--resume] [--from-id N]

Pasos:
  status          Muestra conexión y estado de tablas (no modifica nada)
  bootstrap       Crea DDL + seeds en destino
  copy-catalogs   Copia catálogos prod (company, departments, ranks, attorney, …)
  copy-users      Copia g_users → app_user (join por email en migrate)
  truncate        Vacía tablas normalizadas (re-migración desde cero)
  migrate         Transforma tblLeads → modelo v2 (origen: solo SELECT)
  validate        Conteos y chequeos básicos
  apply-views     Recrea v_tblLeads/tblLeads + vistas ETL compat (g_users, refs, …)
  all             bootstrap → copy-catalogs → copy-users → migrate → validate

Opciones migrate:
  --limit N       Máximo N leads en esta corrida (MIG_LIMIT en .env)
  --resume        Continúa donde quedó (idLead > MAX(glide_id)). No trunca destino.
  --from-id N     Migrar solo idLead Glide > N (avanzado; normalmente usa --resume)
  --dry-run       No escribe en destino

Migración por partes (ejemplo):
  npm run migrate -- --limit 20000          # primer bloque (destino vacío)
  npm run migrate -- --resume --limit 20000 # siguientes bloques
  npm run migrate -- --resume               # todo lo que falte

Destino: MIG_TARGET_* en .env
Origen:  MIG_SOURCE_* (opcional; si falta, todo ocurre en destino)

Proyecto aparte de tnfg-datamart-etl (noFault/lead-normalize-migration/)
`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const migrateOpts = parseMigrateOptions(args);
  const step = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--limit' && args[i - 1] !== '--from-id');

  if (!step || step === 'help' || step === '-h') {
    usage();
    process.exit(step ? 0 : 1);
  }

  console.log(`\nlead-normalize-migration — ${step}${dryRun ? ' (dry-run)' : ''}`);
  console.log(`Destino: ${config.target.host}/${config.target.database}\n`);

  try {
    if (step === 'all') {
      await runBootstrap({ dryRun });
      await runCopyCatalogs({ dryRun });
      await runCopyUsers({ dryRun });
      if (!dryRun) {
        await runMigrate({ dryRun: false });
        await runValidate();
      } else {
        await runMigrate({ dryRun: true });
        console.log('  (dry-run) validate omitido');
      }
      return;
    }

    const fn = STEPS[step];
    if (!fn) {
      console.error(`Paso desconocido: ${step}`);
      usage();
      process.exit(1);
    }

    if (step === 'status' || step === 'validate') {
      await fn();
    } else if (step === 'migrate') {
      await fn({ dryRun, ...migrateOpts });
    } else {
      await fn({ dryRun });
    }
  } finally {
    await closeAll();
  }
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
