const { mirrorGlideTable } = require('./glideMirror');

const TABLE = 'lead_legal_clinical_status';
const SOURCE_TABLE = 'tblLeadsDataLegalClinicalStatus';

/**
 * El estado legal/clínico vigente según Glide, con su convertedValue.
 *
 * Se guarda en vez de derivarse porque no coincide con lo que migramos: para
 * los mismos leads, tblLeads.legalStatus dice "Pending" y esta tabla dice
 * "CONFIRMED". El tablero lee esta.
 */
const SPEC = {
  table: TABLE,
  sourceTable: SOURCE_TABLE,
  select: `Id, IdLead, IdLeadOld, Attorney, TxLocation, ClinicalStatus, LegalStatus,
           IDOT, LDOT, convertedValue, Visits, CreatedAt, row_changed_at, isMiscellaneous`,
  columns: [
    'glide_status_id',
    'id_lead',
    'glide_lead_id',
    'id_lead_old',
    'attorney',
    'tx_location',
    'clinical_status',
    'legal_status',
    'idot',
    'ldot',
    'converted_value',
    'visits',
    'created_at',
    'row_changed_at',
    'is_miscellaneous',
  ],
  mapRow: (r, idLead) => [
    Number(r.Id),
    idLead,
    Number(r.IdLead),
    r.IdLeadOld ?? null,
    r.Attorney ?? null,
    r.TxLocation ?? null,
    r.ClinicalStatus ?? null,
    r.LegalStatus ?? null,
    r.IDOT ?? null,
    r.LDOT ?? null,
    r.convertedValue ?? null,
    r.Visits ?? null,
    r.CreatedAt ?? null,
    r.row_changed_at ?? null,
    // bit(1) llega como Buffer; lo normalizamos a 0/1.
    r.isMiscellaneous == null ? null : Number(r.isMiscellaneous[0] ?? r.isMiscellaneous),
  ],
};

function syncLeadLegalClinicalStatus(sourceConn, targetConn, opts = {}) {
  return mirrorGlideTable(sourceConn, targetConn, SPEC, opts);
}

module.exports = { TABLE, SOURCE_TABLE, SPEC, syncLeadLegalClinicalStatus };
