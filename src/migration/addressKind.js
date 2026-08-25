const config = require('../config');

const KIND = {
  RESIDENCE: 'RESIDENCE',
  MAILING: 'MAILING',
  WORK: 'WORK',
  OTHER: 'OTHER',
};

async function loadAddressKindMap(targetConn) {
  const db = config.target.database;
  const [rows] = await targetConn.query(`
    SELECT id_address_kind, kind_code
    FROM \`${db}\`.ref_address_kind
  `);
  const addressKindByCode = new Map(rows.map((r) => [r.kind_code, r.id_address_kind]));
  return { addressKindByCode };
}

function resolveAddressKindId(maps, kindCode) {
  const id = maps.addressKindByCode.get(kindCode);
  if (!id) {
    throw new Error(`ref_address_kind sin kind_code=${kindCode} — ejecuta bootstrap o patch:state-address`);
  }
  return id;
}

module.exports = {
  KIND,
  loadAddressKindMap,
  resolveAddressKindId,
};
