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

module.exports = { bulkInsert, bulkInsertIgnore };
