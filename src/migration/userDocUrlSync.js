const config = require('../config');

const G_USER_DOC_FIELDS = [
  ['individual_log_url', 'logsIndividualFile'],
  ['roster_file_url', 'rosterIndividualFile'],
  ['machine_file_url', 'machineIndividual'],
  ['lead_sheet_url', 'leadSheetURL'],
  ['individual_lead_sheet_url', 'individualLeadSheetURL'],
];

function trimUrl(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

async function syncUserDocUrlsFromGUsers(sourceConn, targetConn) {
  const src = config.source.database;
  const tgt = config.target.database;
  const selectCols = G_USER_DOC_FIELDS.map(([, srcCol]) => srcCol).join(', ');

  const [rows] = await sourceConn.query(`
    SELECT id, ${selectCols}
    FROM \`${src}\`.g_users
    WHERE id IS NOT NULL
  `);

  const BATCH = 200;
  let updated = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const setClause = G_USER_DOC_FIELDS.map(
      ([tgtCol]) => `\`${tgtCol}\` = CASE id_user ${batch.map(() => 'WHEN ? THEN ?').join(' ')} ELSE \`${tgtCol}\` END`
    ).join(',\n      ');
    const ids = batch.map((r) => r.id);
    const params = [];
    for (const [tgtCol, srcCol] of G_USER_DOC_FIELDS) {
      for (const row of batch) {
        params.push(row.id, trimUrl(row[srcCol]));
      }
    }
    params.push(...ids);

    const sql = `
      UPDATE \`${tgt}\`.app_user
      SET ${setClause}
      WHERE id_user IN (${ids.map(() => '?').join(', ')})
    `;
    const [result] = await targetConn.query(sql, params);
    updated += result.changedRows;
  }

  const [[stats]] = await targetConn.query(`
    SELECT
      SUM(individual_log_url IS NOT NULL) AS with_log,
      SUM(roster_file_url IS NOT NULL) AS with_roster,
      SUM(machine_file_url IS NOT NULL) AS with_machine,
      SUM(lead_sheet_url IS NOT NULL) AS with_lead_sheet,
      SUM(individual_lead_sheet_url IS NOT NULL) AS with_ind_lead_sheet
    FROM \`${tgt}\`.app_user
  `);

  return { gUsers: rows.length, updated, stats };
}

module.exports = { syncUserDocUrlsFromGUsers, G_USER_DOC_FIELDS };
