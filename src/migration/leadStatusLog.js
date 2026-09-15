const { mirrorGlideTable } = require('./glideMirror');

const TABLE = 'lead_status_log';
const SOURCE_TABLE = 'tblLeadsLogsStatus';

/**
 * El estado operativo del lead según Glide: ACTIVE, DROPPED, REF OUT, PROBLEM.
 *
 * REF OUT es el que obliga a guardarlo en vez de derivarlo — un lead referido
 * a un abogado sigue figurando "Came In", con abogado asignado y legalStatus
 * Pending, igual que uno activo.
 */
const SPEC = {
  table: TABLE,
  sourceTable: SOURCE_TABLE,
  select: 'Id, IdLead, IdLeadOld, LogStatus, CreatedAt, row_changed_at',
  columns: [
    'glide_log_id',
    'id_lead',
    'glide_lead_id',
    'id_lead_old',
    'log_status',
    'created_at',
    'row_changed_at',
  ],
  mapRow: (r, idLead) => [
    Number(r.Id),
    idLead,
    Number(r.IdLead),
    r.IdLeadOld ?? null,
    String(r.LogStatus ?? '').trim().toUpperCase(),
    r.CreatedAt ?? null,
    r.row_changed_at ?? null,
  ],
};

function syncLeadStatusLog(sourceConn, targetConn, opts = {}) {
  return mirrorGlideTable(sourceConn, targetConn, SPEC, opts);
}

module.exports = { TABLE, SOURCE_TABLE, SPEC, syncLeadStatusLog };
