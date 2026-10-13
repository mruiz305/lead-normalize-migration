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

function normCatalogText(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

/**
 * Ids cuyo nombre, firma o grupo cambiaron. Esos tres campos van denormalizados
 * en v_tblLeads (attorney, attyFirm, attyContractGroup). Un abogado nuevo no
 * entra: todavía no hay leads que lo apunten.
 */
function changedAttorneyIds(previous, nextRows) {
  const ids = [];
  for (const row of nextRows) {
    const id = Number(row[0]);
    const prev = previous.get(id);
    if (!prev) continue;
    const same =
      normCatalogText(prev.display_name) === normCatalogText(row[1]) &&
      normCatalogText(prev.firm_name) === normCatalogText(row[2]) &&
      normCatalogText(prev.contract_group) === normCatalogText(row[3]);
    if (!same) ids.push(id);
  }
  return ids;
}

/**
 * tblLeads_mat y el datamart solo reescriben un lead si su grafo movió updated_at.
 * Recargar ref_attorney no lo mueve, así que el nombre viejo del abogado queda
 * en la foto. Esto marca lead_legal para que la próxima materialización lo tome.
 */
async function touchLeadsForAttorneys(targetConn, ids) {
  if (!ids.length) return 0;
  const tgt = config.target.database;
  let touched = 0;
  const chunk = 200;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const ph = slice.map(() => '?').join(', ');
    const [result] = await targetConn.query(
      `UPDATE \`${tgt}\`.lead_legal SET updated_at = NOW() WHERE id_attorney IN (${ph})`,
      slice
    );
    touched += Number(result.affectedRows || 0);
  }
  return touched;
}

/** Sync prod refAttorneys → ref_attorney (id_state FK ref_state). */
async function syncAttorneyCatalog(sourceConn, targetConn, stateMap = {}) {
  const src = config.source.database;
  const tgt = config.target.database;
  const { stateByName, stateByCode } = stateMap;

  const [existing] = await targetConn.query(
    `SELECT id_attorney, display_name, firm_name, contract_group
     FROM \`${tgt}\`.ref_attorney`
  );
  const previous = new Map(existing.map((r) => [Number(r.id_attorney), r]));

  const [rows] = await sourceConn.query(`
    SELECT idAttorney, attorney, firm, contractGroup, emailSubjectPrefix, extEmailTargets,
           internalSource, status, states, emails, emailsLD, miscellaneous,
           standardAtty, activeOnPortal, row_changed_at
    FROM \`${src}\`.refAttorneys
    ORDER BY idAttorney
  `);

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

  // Upsert en vez de TRUNCATE + INSERT: este sync corre cada pocos minutos y
  // el catálogo lo leen el portal y el datamart mientras tanto. Un TRUNCATE
  // deja la tabla vacía hasta que termina el INSERT (y para siempre si el
  // INSERT falla), y como hay que apagar las FKs para poder truncar, un
  // abogado borrado en prod dejaba lead_legal.id_attorney colgando sin aviso.
  // Lo que desaparece de prod se marca inactivo y conserva su fila.
  const { upserted, deactivated } = await upsertCatalogRows(targetConn, {
    table: `\`${tgt}\`.ref_attorney`,
    pk: 'id_attorney',
    columns: [
      'id_attorney', 'display_name', 'firm_name', 'contract_group',
      'email_subject_prefix', 'ext_email_targets', 'internal_source', 'is_active', 'id_state',
      'is_emails_enabled', 'is_emails_ld_enabled', 'is_misc',
      'is_standard', 'is_active_on_portal', 'updated_at',
    ],
    rows: attorneyRows,
  });

  const changedIds = changedAttorneyIds(previous, attorneyRows);
  const leadsTouched = await touchLeadsForAttorneys(targetConn, changedIds);

  return {
    attorneys: attorneyRows.length,
    withState,
    changedIds,
    leadsTouched,
    upserted,
    deactivated,
  };
}

/**
 * INSERT … ON DUPLICATE KEY UPDATE por PK de origen, más is_active = 0 para
 * las filas locales que ya no vienen de prod. Si prod no devuelve nada no se
 * apaga nada: una consulta vacía es más probable que un catálogo borrado.
 *
 * @param {{ table: string, pk: string, columns: string[], rows: any[][],
 *           valueSql?: (col: string) => string }} spec
 *   valueSql permite envolver un placeholder (p. ej. ST_GeomFromText(?, 0)).
 */
async function upsertCatalogRows(targetConn, { table, pk, columns, rows, valueSql }) {
  if (!rows.length) {
    return { upserted: 0, deactivated: 0 };
  }
  const rowPh = `(${columns.map((c) => (valueSql ? valueSql(c) : '?')).join(', ')})`;
  const updates = columns
    .filter((c) => c !== pk)
    .map((c) => `\`${c}\` = VALUES(\`${c}\`)`)
    .join(', ');
  const chunk = 200;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    await targetConn.query(
      `INSERT INTO ${table} (${columns.map((c) => `\`${c}\``).join(', ')})
       VALUES ${slice.map(() => rowPh).join(', ')}
       ON DUPLICATE KEY UPDATE ${updates}`,
      slice.flat()
    );
    upserted += slice.length;
  }

  const ids = rows.map((r) => r[0]);
  const [gone] = await targetConn.query(
    `UPDATE ${table} SET is_active = 0
     WHERE is_active = 1 AND \`${pk}\` NOT IN (${ids.map(() => '?').join(', ')})`,
    ids
  );
  return { upserted, deactivated: Number(gone.affectedRows || 0) };
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
  changedAttorneyIds,
  upsertCatalogRows,
  loadAttorneyMap,
  syncAttorneyCatalog,
  migrateLegacyRefAttorneys,
};
