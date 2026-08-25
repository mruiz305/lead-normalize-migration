const config = require('../config');
const { resolvePrimaryStateId } = require('./attorneyCatalog');

function prodStatusToActive(status) {
  return String(status || '').trim().toUpperCase() === 'ACTIVE' ? 1 : 0;
}

function bitToBool(v) {
  if (v == null) return 0;
  if (Buffer.isBuffer(v)) return v[0] ? 1 : 0;
  return v ? 1 : 0;
}

function trimOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function addLookupEntry(map, key, id, isActive) {
  const k = key.trim();
  if (!k) return;
  const prev = map.get(k);
  if (!prev) {
    map.set(k, { id, isActive: !!isActive });
    return;
  }
  if (isActive && !prev.isActive) {
    map.set(k, { id, isActive: true });
  }
}

async function loadTxLocationMap(targetConn) {
  const db = config.target.database;
  const byName = new Map();

  const [rows] = await targetConn.query(`
    SELECT id_tx_location, display_name, is_active
    FROM \`${db}\`.ref_tx_location
    WHERE display_name IS NOT NULL AND TRIM(display_name) <> ''
  `);
  for (const r of rows) {
    addLookupEntry(byName, r.display_name, r.id_tx_location, r.is_active);
  }

  function resolveTxLocationId(raw) {
    const key = String(raw).trim();
    if (!key) return null;
    const hit = byName.get(key);
    return hit ? hit.id : null;
  }

  return { byName, resolveTxLocationId };
}

/** Sync prod refTXLocations → ref_tx_location. */
async function syncTxLocationCatalog(sourceConn, targetConn, stateMap = {}) {
  const src = config.source.database;
  const tgt = config.target.database;

  const [rows] = await sourceConn.query(`
    SELECT idTXLocation, txLocation, txGroup, locationType, address,
           intEmailTargets, extEmailTargets, status, state, activeOnPortal,
           emails, emailsLD, ST_AsText(coordinates) AS coordinates_wkt
    FROM \`${src}\`.refTXLocations
    ORDER BY idTXLocation
  `);

  await targetConn.query('SET FOREIGN_KEY_CHECKS = 0');
  await targetConn.query(`TRUNCATE TABLE \`${tgt}\`.ref_tx_location`);

  const insertRows = [];
  let withState = 0;

  for (const r of rows) {
    const displayName = trimOrNull(r.txLocation);
    if (!displayName) continue;

    const idState = resolvePrimaryStateId(displayName, r.state, stateMap);
    if (idState) withState += 1;

    insertRows.push([
      r.idTXLocation,
      displayName,
      trimOrNull(r.txGroup),
      trimOrNull(r.locationType),
      r.address,
      r.intEmailTargets,
      r.extEmailTargets,
      prodStatusToActive(r.status),
      idState,
      bitToBool(r.activeOnPortal),
      r.coordinates_wkt || 'POINT(0 0)',
      r.emails != null ? Number(r.emails) : 1,
      r.emailsLD != null ? Number(r.emailsLD) : 1,
    ]);
  }

  if (insertRows.length) {
    const ph = insertRows.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ST_GeomFromText(?, 0), ?, ?)').join(', ');
    await targetConn.query(
      `INSERT INTO \`${tgt}\`.ref_tx_location (
        id_tx_location, display_name, tx_group, location_type_code, address,
        int_email_targets, ext_email_targets, is_active, id_state,
        is_active_on_portal, coordinates, is_emails_enabled, is_emails_ld_enabled
      ) VALUES ${ph}`,
      insertRows.flat()
    );
  }

  await targetConn.query('SET FOREIGN_KEY_CHECKS = 1');

  return { locations: insertRows.length, withState };
}

async function migrateLegacyRefTXLocations(targetConn, stateMap) {
  const tgt = config.target.database;
  const [tables] = await targetConn.query(
    `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'refTXLocations' LIMIT 1`,
    [tgt]
  );
  if (!tables.length) return null;

  const [rows] = await targetConn.query(`
    SELECT idTXLocation, txLocation, txGroup, locationType, address,
           intEmailTargets, extEmailTargets, status, state, activeOnPortal,
           emails, emailsLD, ST_AsText(coordinates) AS coordinates_wkt
    FROM \`${tgt}\`.refTXLocations ORDER BY idTXLocation
  `);
  return syncTxLocationCatalog({ query: async () => [rows] }, targetConn, stateMap);
}

module.exports = {
  loadTxLocationMap,
  syncTxLocationCatalog,
  migrateLegacyRefTXLocations,
};
