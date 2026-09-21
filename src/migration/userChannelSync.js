const config = require('../config');

const BATCH_SIZE = 300;

/** g_users column → ref_contact_channel_type.type_code */
const G_USER_CHANNEL_SPECS = [
  { field: 'phone', typeCode: 'PHONE_MOBILE', isPrimary: true },
  { field: 'email', typeCode: 'EMAIL_WORK', isPrimary: true },
  { field: 'fbHandle', typeCode: 'SOCIAL_FACEBOOK', isPrimary: true },
  { field: 'igHandle', typeCode: 'SOCIAL_INSTAGRAM', isPrimary: true },
];

function normValue(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function normEmail(v) {
  const s = normValue(v);
  return s ? s.toLowerCase() : null;
}

async function loadChannelTypeMap(targetConn, db) {
  const [rows] = await targetConn.query(
    `SELECT id_channel_type, type_code FROM \`${db}\`.ref_contact_channel_type WHERE is_active = 1`
  );
  const byCode = new Map();
  for (const r of rows) byCode.set(r.type_code, r.id_channel_type);
  return byCode;
}

function buildUserChannelRows(gUserRow, typeByCode) {
  const idUser = gUserRow.id;
  if (idUser == null) return [];

  const rows = [];
  for (const spec of G_USER_CHANNEL_SPECS) {
    let value = normValue(gUserRow[spec.field]);
    if (!value) continue;
    if (spec.typeCode.startsWith('EMAIL_')) value = normEmail(value);
    const idType = typeByCode.get(spec.typeCode);
    if (!idType) continue;
    rows.push([idUser, idType, value, spec.isPrimary ? 1 : 0]);
  }
  return rows;
}

async function upsertUserChannels(targetConn, db, rows) {
  if (!rows.length) return { updated: 0, inserted: 0 };
  const userIds = [...new Set(rows.map((r) => r[0]))];
  const existing = new Map();
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const chunk = userIds.slice(i, i + BATCH_SIZE);
    const [found] = await targetConn.query(
      `SELECT id_channel, id_user, id_channel_type FROM \`${db}\`.user_channel
       WHERE id_user IN (${chunk.map(() => '?').join(',')})
       ORDER BY is_primary DESC, id_channel`,
      chunk
    );
    for (const r of found) {
      const key = `${Number(r.id_user)}:${Number(r.id_channel_type)}`;
      if (!existing.has(key)) existing.set(key, Number(r.id_channel));
    }
  }

  const toUpdate = [];
  const toInsert = [];
  for (const row of rows) {
    const id = existing.get(`${row[0]}:${row[1]}`);
    if (id) toUpdate.push([id, row[2], row[3]]);
    else toInsert.push([...row, 1]);
  }

  for (const [id, value, isPrimary] of toUpdate) {
    await targetConn.query(
      `UPDATE \`${db}\`.user_channel
       SET channel_value = ?, is_primary = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP
       WHERE id_channel = ?`,
      [value, isPrimary, id]
    );
  }

  let inserted = 0;
  if (toInsert.length) {
    const head = `
      INSERT IGNORE INTO \`${db}\`.user_channel
        (id_user, id_channel_type, channel_value, is_primary, is_active)
      VALUES
    `;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const chunk = toInsert.slice(i, i + BATCH_SIZE);
      const [result] = await targetConn.query(
        `${head} ${chunk.map(() => '(?, ?, ?, ?, ?)').join(', ')}`,
        chunk.flat()
      );
      inserted += result.affectedRows;
    }
  }
  return { updated: toUpdate.length, inserted };
}

async function syncUserChannelsFromGUsers(sourceConn, targetConn, { truncate = false } = {}) {
  const srcDb = config.source.database;
  const tgtDb = config.target.database;

  const typeByCode = await loadChannelTypeMap(targetConn, tgtDb);
  const missing = G_USER_CHANNEL_SPECS.filter((s) => !typeByCode.has(s.typeCode)).map((s) => s.typeCode);
  if (missing.length) {
    throw new Error(`Faltan type_code en ref_contact_channel_type: ${missing.join(', ')}`);
  }

  if (truncate) {
    await targetConn.query('SET FOREIGN_KEY_CHECKS = 0');
    await targetConn.query(`TRUNCATE TABLE \`${tgtDb}\`.user_channel`);
    await targetConn.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  const [gUsers] = await sourceConn.query(`
    SELECT id, rowId, email, phone, fbHandle, igHandle
    FROM \`${srcDb}\`.g_users
    WHERE rowId IS NOT NULL AND TRIM(rowId) <> ''
    ORDER BY id
  `);

  const [appUsers] = await targetConn.query(
    `SELECT id_user, legacy_row_id FROM \`${tgtDb}\`.app_user`
  );
  const idByRowId = new Map(
    appUsers
      .filter((u) => u.legacy_row_id)
      .map((u) => [String(u.legacy_row_id).trim(), Number(u.id_user)])
  );

  const channelRows = [];
  for (const row of gUsers) {
    const rowId = row.rowId ? String(row.rowId).trim() : '';
    const idUser = idByRowId.get(rowId) ?? row.id;
    if (!idUser) continue;
    channelRows.push(...buildUserChannelRows({ ...row, id: idUser }, typeByCode));
  }

  const { updated, inserted } = await upsertUserChannels(targetConn, tgtDb, channelRows);
  const [[{ total }]] = await targetConn.query(
    `SELECT COUNT(*) AS total FROM \`${tgtDb}\`.user_channel`
  );

  return {
    gUsers: gUsers.length,
    channelRows: channelRows.length,
    updated,
    inserted,
    total,
  };
}

module.exports = {
  G_USER_CHANNEL_SPECS,
  buildUserChannelRows,
  loadChannelTypeMap,
  syncUserChannelsFromGUsers,
};
