const { readSql, execSql } = require('../sqlRunner');
const { withTarget } = require('../db');

async function runApplyViews({ dryRun = false } = {}) {
  const files = [
    { file: '03_view_tblLeads_flat.sql', label: 'v_tblLeads + tblLeads' },
    { file: '06_views_etl_compat.sql', label: 'vistas ETL compat (g_users, refs, logs, …)' },
    { file: '05_view_user_rehire_stats.sql', label: 'v_user_rehire_stats', optional: true },
  ];

  console.log('Apply views: compat ETL / tblLeads flat');

  if (dryRun) {
    for (const f of files) {
      console.log(`  (dry-run) Se ejecutaría ${f.file}`);
    }
    return;
  }

  await withTarget(async (conn) => {
    // Evitar que MySQL califique objetos con un default schema fantasma (TNFG_MRUIZ).
    await conn.query('USE `TNFG_INTAKE`');

    for (const f of files) {
      try {
        const sql = readSql(f.file);
        await execSql(conn, sql, f.file);
        console.log(`  ✓ ${f.label}`);
      } catch (err) {
        if (f.optional) {
          console.warn(`  ⚠ ${f.label} omitida: ${err.message}`);
          continue;
        }
        throw err;
      }
    }

    const checks = [
      ['v_tblLeads', 'updated'],
      ['tblLeads', 'updated'],
      ['g_users', 'row_changed_at'],
      ['refAttorneys', 'row_changed_at'],
      ['SpecialList', 'row_changed_at'],
      ['tblCompanyOffices', 'row_changed_at'],
      ['tblLeadComments', 'posted'],
      ['tblLeadsDataLegalClinicalStatus', 'row_changed_at'],
      ['tblLeadsLogsStatus', 'row_changed_at'],
    ];

    for (const [view, watermark] of checks) {
      const [[{ cnt }]] = await conn.query(`SELECT COUNT(*) AS cnt FROM \`${view}\``);
      const [[wm]] = await conn.query(
        `SELECT MAX(\`${watermark}\`) AS mx FROM \`${view}\``
      );
      console.log(`  · ${view}: ${cnt} filas | MAX(${watermark})=${wm.mx}`);
    }
  });
}

module.exports = { runApplyViews };
