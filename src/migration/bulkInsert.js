async function bulkInsert(conn, db, table, columns, rows) {
  if (!rows.length) return null;
  const quoted = table === 'lead' ? '`lead`' : `\`${table}\``;
  const colList = columns.map((c) => `\`${c}\``).join(', ');
  const rowPh = `(${columns.map(() => '?').join(', ')})`;
  const sql = `INSERT INTO \`${db}\`.${quoted} (${colList}) VALUES ${rows.map(() => rowPh).join(', ')}`;
  const [result] = await conn.query(sql, rows.flat());
  return result.insertId;
}

async function bulkInsertIgnore(conn, db, table, columns, rows) {
  if (!rows.length) return;
  const colList = columns.map((c) => `\`${c}\``).join(', ');
  const rowPh = `(${columns.map(() => '?').join(', ')})`;
  const sql = `INSERT IGNORE INTO \`${db}\`.\`${table}\` (${colList}) VALUES ${rows.map(() => rowPh).join(', ')}`;
  await conn.query(sql, rows.flat());
}

/** rows: [pk, ...columnValues] en el mismo orden que `columns` (sin el pk). */
async function bulkUpdateByPk(conn, db, table, pk, columns, rows) {
  if (!rows.length) return 0;
  const quoted = table === 'lead' ? '`lead`' : `\`${table}\``;
  const assignments = columns.map((c) => `\`${c}\` = ?`).join(', ');
  const sql = `UPDATE \`${db}\`.${quoted} SET ${assignments} WHERE \`${pk}\` = ?`;
  for (const row of rows) {
    const pkVal = row[0];
    const values = row.slice(1);
    await conn.query(sql, [...values, pkVal]);
  }
  return rows.length;
}

/**
 * INSERT; si choca la PK/UNIQUE, UPDATE las columnas (salvo skipUpdate).
 * Tablas 1:1 con PK = id_lead: actualiza in-place, no recicla la fila.
 */
async function bulkUpsert(conn, db, table, columns, rows, {
  skipUpdate = ['created_at', 'created_by_user_id'],
} = {}) {
  if (!rows.length) return;
  const quoted = table === 'lead' ? '`lead`' : `\`${table}\``;
  const colList = columns.map((c) => `\`${c}\``).join(', ');
  const rowPh = `(${columns.map(() => '?').join(', ')})`;
  const updateCols = columns.filter((c) => !skipUpdate.includes(c));
  if (!updateCols.length) {
    throw new Error(`bulkUpsert ${table}: skipUpdate dejó el UPDATE vacío`);
  }
  const updates = updateCols.map((c) => `\`${c}\` = VALUES(\`${c}\`)`).join(', ');
  const sql = `INSERT INTO \`${db}\`.${quoted} (${colList}) VALUES ${rows.map(() => rowPh).join(', ')}
    ON DUPLICATE KEY UPDATE ${updates}`;
  await conn.query(sql, rows.flat());
}

module.exports = { bulkInsert, bulkInsertIgnore, bulkUpdateByPk, bulkUpsert };
