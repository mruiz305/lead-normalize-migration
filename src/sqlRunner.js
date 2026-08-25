const fs = require('fs');
const path = require('path');

function readSql(filename) {
  const filePath = path.join(require('./config').sqlDir, filename);
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Califica tblLeads cuando origen y destino son BDs distintas en el mismo servidor.
 */
function qualifyTblLeads(sql, sourceDatabase, targetDatabase) {
  if (!sourceDatabase || sourceDatabase === targetDatabase) {
    return sql;
  }
  const qualified = `\`${sourceDatabase}\`.tblLeads`;
  return sql.replace(/\btblLeads\b/g, qualified);
}

async function execSql(conn, sql, label) {
  const started = Date.now();
  const [result] = await conn.query(sql);
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const affected =
    result && typeof result.affectedRows === 'number' ? result.affectedRows : null;
  const suffix = affected != null ? ` (${affected} filas)` : '';
  console.log(`  ✓ ${label}${suffix} — ${elapsed}s`);
  return result;
}

module.exports = {
  readSql,
  qualifyTblLeads,
  execSql,
};
