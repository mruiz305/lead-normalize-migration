const config = require('../config');

/** Códigos usados en migración tblLeads → client_channel */
const TYPE = {
  PHONE_MOBILE: 'PHONE_MOBILE',
  PHONE_INTAKE_RAW: 'PHONE_INTAKE_RAW',
  PHONE_INTAKE_FORMATTED: 'PHONE_INTAKE_FORMATTED',
  EMAIL_PERSONAL: 'EMAIL_PERSONAL',
};

async function loadContactChannelTypeMap(targetConn) {
  const db = config.target.database;
  const [rows] = await targetConn.query(`
    SELECT id_channel_type, type_code, medium_code
    FROM \`${db}\`.ref_contact_channel_type
    WHERE is_active = 1
  `);
  const channelTypeByCode = new Map();
  const channelTypesByMedium = new Map();
  for (const r of rows) {
    channelTypeByCode.set(r.type_code, r.id_channel_type);
    if (!channelTypesByMedium.has(r.medium_code)) {
      channelTypesByMedium.set(r.medium_code, []);
    }
    channelTypesByMedium.get(r.medium_code).push(r);
  }
  return { channelTypeByCode, channelTypesByMedium };
}

function resolveChannelTypeId(maps, typeCode) {
  const id = maps.channelTypeByCode.get(typeCode);
  if (!id) {
    throw new Error(`ref_contact_channel_type sin type_code=${typeCode} — ejecuta bootstrap o patch:contact-channel`);
  }
  return id;
}

module.exports = {
  TYPE,
  loadContactChannelTypeMap,
  resolveChannelTypeId,
};
