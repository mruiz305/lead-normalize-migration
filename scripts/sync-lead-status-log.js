#!/usr/bin/env node
/**
 * Espeja prod.tblLeadsLogsStatus en TNFG_INTAKE.lead_status_log.
 *
 * Es el insumo del ColorTag del tablero LogReport: el datamart lee la vista
 * tblLeadsLogsStatus, que se apoya en esta tabla. Antes la vista derivaba el
 * estado desde lead_status_event y no podía emitir REF OUT, que es el 21% de
 * los leads en prod.
 *
 * Uso: node scripts/sync-lead-status-log.js [--full] [--dry-run]
 *   --full     ignora la ventana incremental y recorre todo el origen
 *   --dry-run  solo compara volúmenes, no escribe
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { withTarget, withSource, closeAll } = require('../src/db');
const { TABLE, SOURCE_TABLE, syncLeadStatusLog } = require('../src/migration/leadStatusLog');

async function ensureSchema(conn, db) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
    [db, TABLE]
  );
  if (rows.length) return;
  const sql = fs.readFileSync(
    path.join(config.sqlDir, 'patches', 'add_lead_status_log.sql'),
    'utf8'
  );
  await conn.query(sql);
  console.log(`  ✓ ${TABLE} creada`);
}

async function main() {
  const full = process.argv.includes('--full');
  const dryRun = process.argv.includes('--dry-run');
  const db = config.target.database;
  const src = config.source.database;

  console.log(`${TABLE} ← ${src}.${SOURCE_TABLE}${full ? ' (full)' : ''}${dryRun ? ' (dry-run)' : ''}\n`);

  await withTarget(async (targetConn) => {
    if (!dryRun) await ensureSchema(targetConn, db);

    await withSource(async (sourceConn) => {
      const [[prod]] = await sourceConn.query(
        `SELECT COUNT(*) AS n, MAX(row_changed_at) AS ult FROM \`${src}\`.${SOURCE_TABLE}`
      );
      const [[mine]] = await targetConn.query(
        `SELECT COUNT(*) AS n, MAX(row_changed_at) AS ult FROM \`${db}\`.${TABLE}`
      );
      console.log(`  prod:  ${prod.n} filas (último cambio ${prod.ult ?? '—'})`);
      console.log(`  local: ${mine.n} filas (último cambio ${mine.ult ?? '—'})\n`);

      if (dryRun) {
        console.log('(dry-run) no se escribió nada');
        return;
      }

      let ticks = 0;
      const stats = await syncLeadStatusLog(sourceConn, targetConn, {
        full,
        onProgress: ({ read, written }) => {
          ticks += 1;
          if (ticks % 2 === 0) console.log(`  · ${read} leídas / ${written} escritas`);
        },
      });

      console.log(
        `\n  ventana: ${stats.since ? `row_changed_at >= ${stats.since.toISOString().slice(0, 19).replace('T', ' ')}` : 'todo el origen'}`
      );
      console.log(`  leídas de prod:   ${stats.read}`);
      console.log(`  escritas:         ${stats.written}`);
      if (stats.sinLead) {
        console.log(`  sin lead local:   ${stats.sinLead} (llegan cuando migre el lead)`);
      }

      const [[after]] = await targetConn.query(
        `SELECT COUNT(*) AS n, COUNT(DISTINCT id_lead) AS leads FROM \`${db}\`.${TABLE}`
      );
      const [dist] = await targetConn.query(
        `SELECT log_status, COUNT(*) AS n FROM \`${db}\`.${TABLE}
         GROUP BY log_status ORDER BY n DESC`
      );
      console.log(`\n✓ ${TABLE}: ${after.n} filas / ${after.leads} leads`);
      for (const r of dist) console.log(`    ${String(r.log_status).padEnd(10)} ${r.n}`);
    });
  });
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
  })
  .finally(() => closeAll());
