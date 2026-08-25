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

async function bulkInsertUserChannels(targetConn, db, rows) {
  if (!rows.length) return 0;
  const head = `
    INSERT IGNORE INTO \`${db}\`.user_channel
      (id_user, id_channel_type, channel_value, is_primary, is_active)
    VALUES
  `;
  const placeholder = '(?, ?, ?, ?, 1)';
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const params = chunk.flat();
    const [result] = await targetConn.query(
      `${head} ${chunk.map(() => placeholder).join(', ')}`,
      params
    );
    inserted += result.affectedRows;
  }
  return inserted;
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
    SELECT id, email, phone, fbHandle, igHandle
    FROM \`${srcDb}\`.g_users
    WHERE email IS NOT NULL AND TRIM(email) <> ''
    ORDER BY id
  `);

  const channelRows = [];
  for (const row of gUsers) {
    channelRows.push(...buildUserChannelRows(row, typeByCode));
  }

  const inserted = await bulkInsertUserChannels(targetConn, tgtDb, channelRows);
  const [[{ total }]] = await targetConn.query(
    `SELECT COUNT(*) AS total FROM \`${tgtDb}\`.user_channel`
  );

  return { gUsers: gUsers.length, channelRows: channelRows.length, inserted, total };
}

module.exports = {
  G_USER_CHANNEL_SPECS,
  buildUserChannelRows,
  loadChannelTypeMap,
  syncUserChannelsFromGUsers,
};
