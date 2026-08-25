const config = require('../config');

/** Quita sufijo operativo del dashboard (G:0/37 MTD (Satisfied)). Solo migración. */
function normalizeAttorneyLookup(value) {
  if (value == null) return '';
  return String(value)
    .trim()
    // sufijo operativo MTD del dashboard
    .replace(/\s+G:\d+\/\d+\s+MTD\s*\([^)]*\)\s*$/i, '')
    // variante " NS" (New Source / Not Satisfied) que a veces viene en tblLeads
    .replace(/\s+NS\s*$/i, '')
    .trim();
}

function parseStatesText(text) {
  if (text == null || String(text).trim() === '') return [];
  return [...new Set(
    String(text)
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  )];
}

function prodStatusToActive(status) {
  return String(status || '').trim().toUpperCase() === 'ACTIVE' ? 1 : 0;
}

function bitToBool(v) {
  if (v == null) return 0;
  if (Buffer.isBuffer(v)) return v[0] ? 1 : 0;
  return v ? 1 : 0;
}

/** Un estado por abogado: nombre (FL/TX) → prod states → preferir Florida si hay varios. */
function resolvePrimaryStateId(displayName, statesText, { stateByName, stateByCode } = {}) {
  if (!stateByName?.size) return null;

  const name = String(displayName || '').trim();
  const paren = name.match(/\(([A-Za-z]{2,})\)\s*$/);
  if (paren) {
    const token = paren[1].trim();
    if (token.length === 2) {
      const byCode = stateByCode?.get(token.toUpperCase());
      if (byCode) return byCode;
    }
    const byName = stateByName.get(token.toLowerCase());
    if (byName) return byName;
  }

  const lowerName = name.toLowerCase();
  for (const [stateName, idState] of stateByName) {
    if (stateName.length >= 4 && lowerName.includes(stateName)) return idState;
  }

  const parsed = parseStatesText(statesText);
  if (parsed.length === 1) {
    return stateByName.get(parsed[0].toLowerCase()) ?? null;
  }
  if (parsed.length > 1) {
    const fl = stateByName.get('florida');
    if (fl && parsed.some((s) => s.toLowerCase() === 'florida')) return fl;
    return stateByName.get(parsed[0].toLowerCase()) ?? null;
  }
  return null;
}

function addLookupEntry(map, key, attorneyId, isActive) {
  const k = String(key || '').trim();
  if (!k) return;
  // Case-insensitive: legacy a veces usa "(texas)" vs catálogo "(Texas)"
  const lookupKey = k.toLowerCase();
  const prev = map.get(lookupKey);
  if (!prev) {
    map.set(lookupKey, { id: attorneyId, isActive: !!isActive });
    return;
  }
  if (isActive && !prev.isActive) {
    map.set(lookupKey, { id: attorneyId, isActive: true });
  }
}

/** Mapa in-memory para resolver tblLeads.attorney → id_attorney. */
async function loadAttorneyMap(targetConn) {
  const db = config.target.database;
  const byName = new Map();

  const [rows] = await targetConn.query(`
    SELECT id_attorney, display_name, is_active
    FROM \`${db}\`.ref_attorney
    WHERE display_name IS NOT NULL AND TRIM(display_name) <> ''
  `);
  for (const r of rows) {
    addLookupEntry(byName, r.display_name, r.id_attorney, r.is_active);
    const norm = normalizeAttorneyLookup(r.display_name);
    if (norm && norm.toLowerCase() !== String(r.display_name).trim().toLowerCase()) {
      addLookupEntry(byName, norm, r.id_attorney, r.is_active);
    }
  }

  function resolveAttorneyId(raw) {
    const key = String(raw == null ? '' : raw).trim();
    if (!key) return null;
    const norm = normalizeAttorneyLookup(key);
    for (const k of [key, norm]) {
      if (!k) continue;
      const hit = byName.get(k.toLowerCase());
      if (hit) return hit.id;
    }
    return null;
  }

  return { byName, resolveAttorneyId };
}

/** Sync prod refAttorneys → ref_attorney (id_state FK ref_state). */
async function syncAttorneyCatalog(sourceConn, targetConn, stateMap = {}) {
  const src = config.source.database;
  const tgt = config.target.database;
  const { stateByName, stateByCode } = stateMap;

  const [rows] = await sourceConn.query(`
    SELECT idAttorney, attorney, firm, contractGroup, emailSubjectPrefix, extEmailTargets,
           internalSource, status, states, emails, emailsLD, miscellaneous,
           standardAtty, activeOnPortal, row_changed_at
    FROM \`${src}\`.refAttorneys
    ORDER BY idAttorney
  `);

  await targetConn.query('SET FOREIGN_KEY_CHECKS = 0');
  await targetConn.query(`TRUNCATE TABLE \`${tgt}\`.ref_attorney`);

  const attorneyRows = [];
  let withState = 0;

  for (const r of rows) {
    const displayName = r.attorney != null ? String(r.attorney).trim() : '';
    if (!displayName) continue;

    const idState = resolvePrimaryStateId(displayName, r.states, { stateByName, stateByCode });
    if (idState) withState += 1;

    attorneyRows.push([
      r.idAttorney,
      displayName,
      r.firm != null ? String(r.firm).trim() || null : null,
      r.contractGroup != null ? String(r.contractGroup).trim() || null : null,
      r.emailSubjectPrefix,
      r.extEmailTargets,
      r.internalSource != null ? String(r.internalSource).trim() || null : null,
      prodStatusToActive(r.status),
      idState,
      r.emails != null ? Number(r.emails) : 1,
      r.emailsLD != null ? Number(r.emailsLD) : 1,
      r.miscellaneous != null ? Number(r.miscellaneous) : 0,
      bitToBool(r.standardAtty),
      bitToBool(r.activeOnPortal),
      r.row_changed_at,
    ]);
  }

  if (attorneyRows.length) {
    const ph = attorneyRows.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    await targetConn.query(
      `INSERT INTO \`${tgt}\`.ref_attorney (
        id_attorney, display_name, firm_name, contract_group,
        email_subject_prefix, ext_email_targets, internal_source, is_active, id_state,
        is_emails_enabled, is_emails_ld_enabled, is_misc,
        is_standard, is_active_on_portal, updated_at
      ) VALUES ${ph}`,
      attorneyRows.flat()
    );
  }

  await targetConn.query('SET FOREIGN_KEY_CHECKS = 1');

  return { attorneys: attorneyRows.length, withState };
}

async function migrateLegacyRefAttorneys(targetConn, stateMap) {
  const tgt = config.target.database;
  const [tables] = await targetConn.query(
    `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'refAttorneys' LIMIT 1`,
    [tgt]
  );
  if (!tables.length) return null;

  const [rows] = await targetConn.query(`SELECT * FROM \`${tgt}\`.refAttorneys ORDER BY idAttorney`);
  return syncAttorneyCatalog({ query: async () => [rows] }, targetConn, stateMap);
}

module.exports = {
  normalizeAttorneyLookup,
  parseStatesText,
  resolvePrimaryStateId,
  loadAttorneyMap,
  syncAttorneyCatalog,
  migrateLegacyRefAttorneys,
};
