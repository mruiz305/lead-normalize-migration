#!/usr/bin/env node
/**
 * Alta en prod dbProduction.tblCron + tblCronConfig para el sync intake.
 * Mismo mecanismo que ETL_DM_CRON / otros procesos.
 *
 *   npm run sync:ensure-cron
 *   npm run sync:ensure-cron -- --dry-run
 *   npm run sync:ensure-cron -- --expression "star-slash-10 * * * *"
 *   (expression default: cada 10 minutos)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { withSource, closeAll } = require('../src/db');
const config = require('../src/config');

const SCRIPT = process.env.PROCESS_NAME_INTAKE_SYNC || 'TNFG_INTAKE_SYNC';
const CRON_CODE = 'INTAKE_SYNC_10M';
const DESC = 'Sync incremental prod → TNFG_INTAKE (leads + ref_attorney)';

function parseArgs(argv) {
  const i = argv.indexOf('--expression');
  // default: every 10 minutes
  const everyTenMin = '*/' + '10 * * * *';
  return {
    dryRun: argv.includes('--dry-run'),
    expression: i >= 0 ? argv[i + 1] : everyTenMin,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log(`ensure cron: script_code=${SCRIPT} expression=${opts.expression}`);
  console.log(`  origen: ${config.source.host}/${config.source.database}`);
  console.log(`  modo: ${opts.dryRun ? 'dry-run' : 'LIVE'}\n`);

  await withSource(async (conn) => {
    const db = config.source.database;

    const [[existing]] = await conn.query(
      `SELECT cc.id AS cfg_id, cc.script_code, c.id AS cron_id, c.code, c.expression, c.is_active
       FROM \`${db}\`.tblCronConfig cc
       JOIN \`${db}\`.tblCron c ON c.id = cc.cron_config_id
       WHERE cc.script_code = ?
       LIMIT 1`,
      [SCRIPT]
    );

    if (existing) {
      console.log('Ya existe:', existing);
      if (
        existing.expression !== opts.expression ||
        !existing.is_active
      ) {
        if (opts.dryRun) {
          console.log(`(dry-run) UPDATE tblCron id=${existing.cron_id}`);
          return;
        }
        await conn.query(
          `UPDATE \`${db}\`.tblCron
           SET expression = ?, is_active = 1, description = ?
           WHERE id = ?`,
          [opts.expression, DESC, existing.cron_id]
        );
        console.log(`✓ Actualizado cron_id=${existing.cron_id} → ${opts.expression}`);
      } else {
        console.log('✓ Sin cambios');
      }
      return;
    }

    let [[cron]] = await conn.query(
      `SELECT id, code, expression FROM \`${db}\`.tblCron
       WHERE expression = ? AND is_active = 1 LIMIT 1`,
      [opts.expression]
    );

    if (opts.dryRun) {
      console.log(cron ? `(dry-run) reusar tblCron id=${cron.id}` : '(dry-run) INSERT tblCron + tblCronConfig');
      return;
    }

    if (!cron) {
      const [ins] = await conn.query(
        `INSERT INTO \`${db}\`.tblCron (code, expression, description, is_active)
         VALUES (?, ?, ?, 1)`,
        [CRON_CODE, opts.expression, DESC]
      );
      cron = { id: ins.insertId, code: CRON_CODE, expression: opts.expression };
      console.log('✓ Creado tblCron:', cron);
    } else {
      console.log('· Reusando tblCron:', cron);
    }

    const [cfg] = await conn.query(
      `INSERT INTO \`${db}\`.tblCronConfig (script_code, cron_config_id, notes)
       VALUES (?, ?, ?)`,
      [SCRIPT, cron.id, DESC]
    );
    console.log(`✓ Creado tblCronConfig id=${cfg.insertId} script_code=${SCRIPT}`);
  });
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
  })
  .finally(() => closeAll());
