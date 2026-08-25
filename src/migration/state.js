const config = require('../config');

async function loadStateMap(targetConn) {
  const db = config.target.database;
  const [rows] = await targetConn.query(`
    SELECT id_state, state_code, state_name
    FROM \`${db}\`.ref_state
    WHERE is_active = 1
  `);
  const stateByName = new Map();
  const stateByCode = new Map();
  for (const r of rows) {
    stateByName.set(String(r.state_name).trim().toLowerCase(), r.id_state);
    stateByCode.set(String(r.state_code).trim().toUpperCase(), r.id_state);
  }
  return { stateByName, stateByCode };
}

function resolveStateId(maps, value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.length <= 3) {
    const byCode = maps.stateByCode.get(raw.toUpperCase());
    if (byCode) return byCode;
  }
  return maps.stateByName.get(raw.toLowerCase()) ?? null;
}

module.exports = {
  loadStateMap,
  resolveStateId,
};
