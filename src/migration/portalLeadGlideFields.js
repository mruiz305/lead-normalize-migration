const config = require('../config');
const { transformLead, LEAD_SELECT_COLUMNS } = require('./pipeline');

/**
 * Remigrate parcial para leads nacidos en el portal.
 *
 * Un lead del portal se espeja en prod (leads-sync-api) y desde ahí Glide lo
 * ve y lo edita. La fila de prod es una copia reducida del lead del portal,
 * así que el remigrate completo no sirve: reconstruiría el grafo entero desde
 * esa copia y borraría lo que solo existe en el modelo nuevo. Hasta ahora la
 * salida era excluirlos, con lo que cualquier cambio hecho en Glide sobre esos
 * leads quedaba invisible para el portal.
 *
 * Acá se trae de tblLeads solo lo que Glide administra en la operación: estado
 * del lead, abogado y estado legal, clínica y estado clínico, y las fechas de
 * ciclo de vida. Nada del cliente, del accidente, de la org ni de las notas.
 *
 * Reglas:
 *  · Un valor que en prod tiene texto pero no resuelve contra el catálogo
 *    (abogado, clínica, estados) no se escribe: se conserva lo del portal.
 *    Si no, un nombre de abogado mal tipeado en Glide borraría el abogado
 *    correcto que ya está enlazado.
 *  · Solo se escribe cuando algo cambia (comparación <=> en el UPDATE), para
 *    que el updated_at no se mueva en cada ciclo ni dispare al datamart de
 *    más. Eso también corta cualquier rebote portal → prod → portal.
 */

// index = posición en el array que arma transformLead para cada parte.
// raw = columna de tblLeads que, si trae texto y el id resuelve null, inhibe el campo.
// Las fechas se copian con la hora de pared tal cual, igual que hace la
// migración completa para los leads de Glide. No hay conversión posible: en
// prod conviven valores que leads-sync-api copió del portal (UTC) con los que
// Glide genera con su propio reloj (America/New_York: dateSigned, dateCameIn).
const PORTAL_GLIDE_FIELDS = [
  { table: 'lead', part: 'lead', column: 'id_lead_status', index: 1, raw: 'leadStatus' },
  { table: 'lead', part: 'lead', column: 'id_stage', index: 2, raw: 'stage' },

  { table: 'lead_legal', part: 'legal', column: 'id_attorney', index: 1, raw: 'attorney' },
  { table: 'lead_legal', part: 'legal', column: 'id_legal_status', index: 2, raw: 'legalStatus' },
  { table: 'lead_legal', part: 'legal', column: 'ticket_attorney', index: 3 },
  { table: 'lead_legal', part: 'legal', column: 'date_legal_accepted', index: 8 },
  { table: 'lead_legal', part: 'legal', column: 'date_legal_rejected', index: 9 },
  { table: 'lead_legal', part: 'legal', column: 'signing_at', index: 10 },
  { table: 'lead_legal', part: 'legal', column: 'date_signed', index: 11 },
  { table: 'lead_legal', part: 'legal', column: 'is_docusign', index: 12 },

  { table: 'lead_clinical', part: 'clinical', column: 'id_tx_location', index: 1, raw: 'txLocation' },
  { table: 'lead_clinical', part: 'clinical', column: 'id_clinical_status', index: 2, raw: 'clinicalStatus' },
  { table: 'lead_clinical', part: 'clinical', column: 'appointment_at', index: 5 },
  { table: 'lead_clinical', part: 'clinical', column: 'visits', index: 6 },
  { table: 'lead_clinical', part: 'clinical', column: 'idot', index: 7 },
  { table: 'lead_clinical', part: 'clinical', column: 'ldot', index: 8 },
  { table: 'lead_clinical', part: 'clinical', column: 'date_clinical_accepted', index: 9 },
  { table: 'lead_clinical', part: 'clinical', column: 'date_clinical_rejected', index: 10 },

  { table: 'lead_timeline', part: 'timeline', column: 'date_came_in', index: 2 },
  { table: 'lead_timeline', part: 'timeline', column: 'date_locked_down', index: 3 },
  { table: 'lead_timeline', part: 'timeline', column: 'date_dropped', index: 4 },
  { table: 'lead_timeline', part: 'timeline', column: 'callback_at', index: 5 },
  { table: 'lead_timeline', part: 'timeline', column: 'reason_pending', index: 6 },
  { table: 'lead_timeline', part: 'timeline', column: 'reason_drop', index: 7 },
  { table: 'lead_timeline', part: 'timeline', column: 'other_drop_reason', index: 8 },
  { table: 'lead_timeline', part: 'timeline', column: 'lka_date', index: 9 },
];

const TABLES = [...new Set(PORTAL_GLIDE_FIELDS.map((f) => f.table))];

function hasText(v) {
  return v != null && String(v).trim() !== '';
}

/**
 * @param {object} row fila de tblLeads (LEAD_SELECT_COLUMNS)
 * @param {object} item salida de transformLead(row)
 * @returns {{ patch: Record<string, Record<string, any>>, skipped: string[] }}
 *   patch[table][column] = valor; skipped = campos inhibidos por catálogo.
 */
function buildPortalPatch(row, item) {
  const patch = {};
  const skipped = [];
  for (const f of PORTAL_GLIDE_FIELDS) {
    const value = item[f.part][f.index];
    if (f.raw && value == null && hasText(row[f.raw])) {
      skipped.push(f.column);
      continue;
    }
    if (!patch[f.table]) patch[f.table] = {};
    patch[f.table][f.column] = value;
  }
  return { patch, skipped };
}

function tableSql(db, table) {
  return table === 'lead' ? `\`${db}\`.\`lead\`` : `\`${db}\`.\`${table}\``;
}

/**
 * Qué difiere hoy en la base respecto del patch.
 * @returns {{ [table]: { missing: boolean, changed: string[] } }}
 */
async function diffPortalPatch(targetConn, idLead, patch) {
  const db = config.target.database;
  const out = {};
  for (const table of Object.keys(patch)) {
    const cols = Object.keys(patch[table]);
    if (!cols.length) continue;
    const [rows] = await targetConn.query(
      `SELECT ${cols.map((c) => `(\`${c}\` <=> ?) AS \`${c}\``).join(', ')}
       FROM ${tableSql(db, table)} WHERE id_lead = ?`,
      [...cols.map((c) => patch[table][c]), idLead]
    );
    if (!rows.length) {
      // Sin fila y sin nada que poner: no es una diferencia (ver applyPortalPatch).
      if (cols.some((c) => patch[table][c] != null)) {
        out[table] = { missing: true, changed: cols };
      }
      continue;
    }
    const changed = cols.filter((c) => Number(rows[0][c]) !== 1);
    if (changed.length) out[table] = { missing: false, changed };
  }
  return out;
}

function describeDiff(diff) {
  return Object.entries(diff).map(([t, d]) =>
    d.missing ? `${t}:(sin fila)` : d.changed.map((c) => `${t}.${c}`).join(', ')
  );
}

/**
 * Escribe solo las tablas con diferencias. Una tabla 1:1 que el portal nunca
 * creó (lead_legal, lead_clinical, lead_timeline) se inserta: el API del
 * portal las actualiza con UPDATE … WHERE id_lead, así que sin la fila sus
 * propias ediciones tampoco pegarían. `lead` siempre existe. updated_at con
 * NOW() de la base, no con el reloj de esta máquina.
 * @returns {number} filas escritas
 */
async function applyPortalPatch(targetConn, idLead, patch, diff) {
  const db = config.target.database;
  let written = 0;
  for (const table of Object.keys(diff)) {
    const d = diff[table];
    if (d.missing) {
      if (table === 'lead') continue;
      const cols = Object.keys(patch[table]);
      // Una fila de puros NULL no aporta nada; se crea cuando Glide tenga algo.
      if (!cols.some((c) => patch[table][c] != null)) continue;
      await targetConn.query(
        `INSERT INTO ${tableSql(db, table)}
           (id_lead, ${cols.map((c) => `\`${c}\``).join(', ')}, created_at, updated_at)
         VALUES (?, ${cols.map(() => '?').join(', ')}, NOW(), NOW())`,
        [idLead, ...cols.map((c) => patch[table][c])]
      );
      written += 1;
      continue;
    }
    const cols = d.changed;
    const [r] = await targetConn.query(
      `UPDATE ${tableSql(db, table)}
       SET ${cols.map((c) => `\`${c}\` = ?`).join(', ')}, updated_at = NOW()
       WHERE id_lead = ?`,
      [...cols.map((c) => patch[table][c]), idLead]
    );
    written += Number(r.affectedRows || 0);
  }
  return written;
}

/** Segundos que el reloj de esa base lleva respecto de UTC (NY: -14400 en verano). */
async function clockOffsetSeconds(conn) {
  const [[r]] = await conn.query(
    'SELECT TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), NOW()) AS off'
  );
  return Number(r.off || 0);
}

/** Wall-clock de la base (Date de mysql2 o string 'YYYY-MM-DD HH:MM:SS') → epoch ms en UTC. */
function wallClockToUtcMs(value, offsetSeconds) {
  if (value == null) return null;
  let y, mo, d, h, mi, se;
  if (value instanceof Date) {
    [y, mo, d, h, mi, se] = [
      value.getFullYear(), value.getMonth(), value.getDate(),
      value.getHours(), value.getMinutes(), value.getSeconds(),
    ];
  } else {
    const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (!m) return null;
    [y, mo, d, h, mi, se] = [+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]];
  }
  return Date.UTC(y, mo, d, h, mi, se) - offsetSeconds * 1000;
}

/** Último cambio del grafo del lead en INTAKE (lead + 1:1 que Glide toca), como string. */
async function loadIntakeUpdatedAt(targetConn, idLeads) {
  const db = config.target.database;
  if (!idLeads.length) return new Map();
  const [rows] = await targetConn.query(
    `SELECT l.id_lead,
            DATE_FORMAT(GREATEST(
              l.updated_at,
              COALESCE(ll.updated_at, l.updated_at),
              COALESCE(lc.updated_at, l.updated_at),
              COALESCE(lt.updated_at, l.updated_at)
            ), '%Y-%m-%d %H:%i:%s') AS last
     FROM \`${db}\`.\`lead\` l
     LEFT JOIN \`${db}\`.lead_legal ll ON ll.id_lead = l.id_lead
     LEFT JOIN \`${db}\`.lead_clinical lc ON lc.id_lead = l.id_lead
     LEFT JOIN \`${db}\`.lead_timeline lt ON lt.id_lead = l.id_lead
     WHERE l.id_lead IN (${idLeads.map(() => '?').join(',')})`,
    idLeads
  );
  return new Map(rows.map((r) => [Number(r.id_lead), r.last]));
}

/** Margen para que el espejo recién escrito por leads-sync-api cuente como "tan nuevo" como el portal. */
const FRESHNESS_TOLERANCE_MS = 60 * 1000;

/**
 * @param {Map<number, number>} portalOwned glide_id → id_lead (origin = PORTAL)
 * @param {object} opts
 * @param {string} opts.readSql tabla de lectura (staging o prod)
 * @param {number} opts.sourceOffsetSeconds reloj de prod vs UTC (los `updated` están en ese reloj)
 * @param {number} opts.targetOffsetSeconds reloj de INTAKE vs UTC
 *
 * Regla de conflicto: último en escribir gana, a nivel lead. Si el grafo en
 * INTAKE es más nuevo que el `updated` de prod, el portal escribió después
 * (o leads-sync-api no llegó a reflejarlo) y Glide no pisa nada.
 */
async function remigratePortalOwned(readConn, targetConn, maps, portalOwned, {
  readSql,
  sourceOffsetSeconds = 0,
  targetOffsetSeconds = 0,
  dryRun = false,
  batch = 100,
  onLead,
} = {}) {
  const stats = {
    leads: 0, leadsChanged: 0, rowsWritten: 0, skippedFields: 0, portalNewer: 0, samples: [],
  };
  const glideIds = [...portalOwned.keys()].sort((a, b) => a - b);
  if (!glideIds.length) return stats;

  const colList = LEAD_SELECT_COLUMNS.map((c) => `\`${c}\``).join(', ');
  for (let i = 0; i < glideIds.length; i += batch) {
    const slice = glideIds.slice(i, i + batch);
    const [rows] = await readConn.query(
      `SELECT ${colList} FROM ${readSql} WHERE idLead IN (${slice.map(() => '?').join(',')})
       ORDER BY idLead`,
      slice
    );
    const intakeLast = await loadIntakeUpdatedAt(
      targetConn,
      rows.map((r) => portalOwned.get(Number(r.idLead))).filter(Boolean)
    );
    for (const row of rows) {
      const glideId = Number(row.idLead);
      const idLead = portalOwned.get(glideId);
      if (!idLead) continue;
      stats.leads += 1;

      const prodMs = wallClockToUtcMs(row.updated, sourceOffsetSeconds);
      const intakeMs = wallClockToUtcMs(intakeLast.get(idLead), targetOffsetSeconds);
      if (prodMs != null && intakeMs != null && prodMs + FRESHNESS_TOLERANCE_MS < intakeMs) {
        stats.portalNewer += 1;
        if (onLead) onLead({ idLead, glideId, portalNewer: true });
        continue;
      }

      const item = transformLead(row, maps);
      const { patch, skipped } = buildPortalPatch(row, item);
      stats.skippedFields += skipped.length;

      const diff = await diffPortalPatch(targetConn, idLead, patch);
      const changed = Object.keys(diff).length > 0;
      if (changed) {
        stats.leadsChanged += 1;
        if (stats.samples.length < 10) {
          stats.samples.push({ glideId, idLead, diff: describeDiff(diff), skipped });
        }
        if (!dryRun) stats.rowsWritten += await applyPortalPatch(targetConn, idLead, patch, diff);
      }
      if (onLead) onLead({ idLead, glideId, diff, skipped });
    }
  }
  return stats;
}

module.exports = {
  PORTAL_GLIDE_FIELDS,
  TABLES,
  FRESHNESS_TOLERANCE_MS,
  buildPortalPatch,
  diffPortalPatch,
  describeDiff,
  applyPortalPatch,
  clockOffsetSeconds,
  wallClockToUtcMs,
  remigratePortalOwned,
};
