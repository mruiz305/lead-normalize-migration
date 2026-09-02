/**
 * Mapa legacy → TNFG_INTAKE para programadores.
 * Fuente: diccionario React (schema-catalog.json) + MODELO_Y_MAPEO.md
 */
const { TBLLEADS_COLUMN_GROUPS } = require('./tblLeads-column-map');
const { G_USERS_COLUMN_GROUPS } = require('./g-users-column-map');

const MIGRATION_PIPELINE = [
  { step: 1, label: 'DDL + seeds', target: 'TNFG_INTAKE vacío' },
  { step: 2, label: 'Catálogos prod', target: 'ref_*' },
  { step: 3, label: 'Staff', target: 'app_user · hierarchy_membership' },
  { step: 4, label: 'Leads', target: 'lead + lead_* · client*' },
  { step: 5, label: 'Log I/U/D', target: 'entity_log · log_detail · id_log' },
  { step: 6, label: 'Comentarios', target: 'lead_note (comment)' },
  { step: 7, label: 'QA', target: 'conteos + FKs' },
];

const MIGRATION_SOURCES = [
  {
    id: 'tblLeads',
    legacy: 'dbProduction.tblLeads',
    kind: 'wide-table',
    summary: 'Tabla ancha ~189 columnas · 1 fila = 1 caso (representantes)',
    volume: '~147K filas',
    color: 'teal',
    destinations: [
      { label: 'Núcleo del caso', tables: ['lead'], note: 'PK id_lead local; glide_id = puente Glide (histórico iguales)' },
      { label: 'Ciclo de vida', tables: ['lead_timeline', 'lead_status_event'], note: 'Fechas y cambios de status del lead' },
      { label: 'Org congelada', tables: ['lead_org_snapshot'], note: 'Directorate → duo al momento de crear el caso' },
      { label: 'Lesionado', tables: ['client', 'client_channel', 'client_address'], note: 'Persona principal del caso' },
      { label: 'Copasajeros', tables: ['lead_party', 'lead_party_injury_site'], note: 'Pasajeros psngr1…5' },
      { label: 'Accidente', tables: ['lead_accident'], note: 'Severidades, at-fault, datos del siniestro' },
      { label: 'Legal', tables: ['lead_legal'], note: 'Abogado + FK ref_attorney' },
      { label: 'Clínico', tables: ['lead_clinical'], note: 'Cita TX y estado clínico' },
      { label: 'Lesiones', tables: ['lead_injury', 'lead_injury_site'], note: 'Lesiones del lesionado principal' },
      { label: 'Seguros', tables: ['lead_insurance'], note: 'PIP · AT_FAULT · PASSENGER por party' },
      { label: 'Staff del caso', tables: ['lead_staff'], note: 'submitter · intake · creator' },
      { label: 'Notas / snapshots', tables: ['lead_note'], note: 'Snapshots intake, accident, hospital' },
      { label: 'Flags sync', tables: ['lead_sync_flag'], note: 'COR · AFF · ATTY · emails' },
      { label: 'Auditoría I/U/D', tables: ['entity_log', 'log_detail'], note: 'Historial por registro (runtime tnfg-intake-api)' },
    ],
    columnGroupsId: 'tblLeads',
  },
  {
    id: 'g_users',
    legacy: 'dbProduction.g_users',
    kind: 'staff',
    summary: 'Staff representantes — no viene de tblLeads',
    volume: '~2.5K usuarios',
    color: 'rose',
    destinations: [
      { label: 'Perfil staff', tables: ['app_user'], note: 'Identidad, HR, compensación (DealGoal, paylocityId), URLs' },
      { label: 'Contacto', tables: ['user_channel'], note: 'Teléfonos, email, fbHandle, igHandle' },
      { label: 'Jerarquía', tables: ['hierarchy_membership'], note: 'Office → pod → team → duo (org actual)' },
      { label: 'Historial HR', tables: ['user_hr_period'], note: 'Pasadas laborales cerradas (rehire / email duplicado)' },
      { label: 'Permisos extra', tables: ['user_access_grant'], note: 'Grants scope ajeno — hierarchySpecialAccess* pendiente' },
    ],
    notes: [
      'Compensación: hr_deal_goal ← COALESCE(DealGoal, hrDealGoal); hr_deal_goal_custom ← DealGoalCustom; paylocity_id ← paylocityId',
      'Backfill incremental: npm run backfill:app-user-deal-paylocity',
    ],
  },
  {
    id: 'tblLeadComments',
    legacy: 'dbProduction.tblLeadComments',
    kind: 'comments',
    summary: 'Hilo de comentarios por lead',
    volume: '~352K filas',
    color: 'violet',
    destinations: [
      { label: 'Comentarios', tables: ['lead_note'], note: "note_type='comment' · source · mentions · recipient_user_ids" },
    ],
  },
  {
    id: 'ref_catalogs',
    legacy: 'ref_attorney · refTXLocations · refInsurance · refLeadStatus · …',
    kind: 'catalog',
    summary: 'Catálogos de producción (solo lectura)',
    volume: 'Sync selectivo',
    color: 'slate',
    destinations: [
      { label: 'Catálogos clínicos/legal', tables: ['ref_attorney', 'ref_tx_location', 'ref_insurance_carrier'], note: 'Copiados desde tablas prod' },
      { label: 'Estados del lead', tables: ['refLeadStatus', 'refLegalStatus', 'refClinicalStatus', 'ref_lead_stage'], note: 'Lead, legal, clínico y stage' },
      { label: 'Organización', tables: ['ref_company', 'ref_company_office'], note: 'Compañía y oficinas' },
      { label: 'Lookups base', tables: ['ref_state', 'ref_injury_site', 'ref_severity_level', 'ref_at_fault_type', 'ref_language', 'ref_ee_contract_type'], note: 'Seeds + tokens de sync' },
      { label: 'Portal UI (jul 2026)', tables: ['ref_accident_or_wc', 'ref_hr_status', 'ref_comment_source'], note: 'Edit Lead / UM / chat badges' },
    ],
  },
  {
    id: 'LOGED',
    legacy: 'SGC LOGED / LOGEDDET (conceptual)',
    kind: 'audit',
    summary: 'Historial transaccional legacy por registro',
    volume: 'Backfill post-carga de leads',
    color: 'amber',
    destinations: [
      { label: 'Cabecera log', tables: ['entity_log'], note: '1 fila por registro (entity_table + entity_pk)' },
      { label: 'Detalle log', tables: ['log_detail'], note: 'Append-only I/U/D con JSON de cambios' },
    ],
    notes: ['Columna id_log en tablas transaccionales', 'Runtime: tnfg-intake-api entityLogWriteService'],
  },
];

/** Panorama legacy → grupos TNFG (diagrama ER de correspondencia) */
const MIGRATION_CORRESPONDENCE_OVERVIEW = [
  {
    legacyId: 'tblLeads',
    legacy: 'dbProduction.tblLeads',
    targetLabel: 'Caso Representatives normalizado',
    targetTables: ['lead', 'lead_*', 'client*', 'lead_party'],
    color: 'teal',
  },
  {
    legacyId: 'g_users',
    legacy: 'dbProduction.g_users',
    targetLabel: 'Staff y jerarquía',
    targetTables: ['app_user', 'user_channel', 'hierarchy_membership', 'user_hr_period'],
    color: 'rose',
  },
  {
    legacyId: 'tblLeadComments',
    legacy: 'dbProduction.tblLeadComments',
    targetLabel: 'Comentarios',
    targetTables: ['lead_note'],
    color: 'violet',
  },
  {
    legacyId: 'ref_catalogs',
    legacy: 'ref_* (prod)',
    targetLabel: 'Catálogos TNFG',
    targetTables: ['ref_attorney', 'ref_company', 'refLeadStatus', 'ref_*'],
    color: 'slate',
  },
  {
    legacyId: 'LOGED',
    legacy: 'LOGED / LOGEDDET',
    targetLabel: 'Auditoría I/U/D',
    targetTables: ['entity_log', 'log_detail'],
    color: 'amber',
  },
];

/** Relaciones ER por origen — agrupadas por concepto (sin líneas cruzadas) */
function buildSourceCorrespondence(source) {
  const defaultCard = (tables) => (tables.length > 1 ? '1:N' : '1:1');
  const groups = source.destinations.map((d) => ({
    label: d.label,
    tables: d.tables,
    note: d.note,
    cardinality: d.cardinality || defaultCard(d.tables),
  }));
  return {
    legacy: source.legacy,
    legacyShort: source.legacy.split('.').pop()?.split(' ')[0] || source.legacy,
    color: source.color,
    database: source.database || 'TNFG_INTAKE',
    groups,
  };
}

const MIGRATION_ER_DIAGRAM_MERMAID = `erDiagram
  tblLeads ||--|| lead : "idLead"
  lead ||--|| lead_accident : "1-1"
  lead ||--|| lead_legal : "1-1"
  lead ||--|| lead_clinical : "1-1"
  lead ||--|| lead_org_snapshot : "1-1"
  lead ||--o| client : "lesionado"
  client ||--o{ client_channel : "telefonos"
  client ||--o| client_address : "0-1"
  lead ||--o{ lead_party : "copasajeros"
  lead ||--o{ lead_note : "notas"
  lead ||--o| entity_log : "auditoria"
  entity_log ||--o{ log_detail : "I-U-D"
  g_users ||--o{ app_user : "staff"
  app_user ||--o{ user_channel : "contacto"
  app_user ||--o{ hierarchy_membership : "org"
  tblLeadComments ||--o{ lead_note : "comment"
  ref_catalogs ||--o{ ref_attorney : "lookup"
  ref_catalogs ||--o{ ref_company : "lookup"`;

function renderMarkdownFlowSection() {
  const lines = [
    '## Diagrama de flujo — legacy → tablas destino',
    '',
    'Referencia para programadores: **de dónde sale cada tabla** en `TNFG`.',
    '',
    '### Fases de carga del modelo',
    '',
    '| Paso | Qué hace | Destino |',
    '|------|----------|---------|',
  ];

  for (const p of MIGRATION_PIPELINE) {
    lines.push(`| ${p.step} | ${p.label} | ${p.target} |`);
  }

  lines.push('', '### Orígenes legacy → tablas', '');

  for (const src of MIGRATION_SOURCES) {
    lines.push(`#### ${src.legacy}`);
    lines.push('');
    lines.push(`*${src.summary}* · ${src.volume}`);
    lines.push('');
    lines.push('| Tabla(s) destino | Notas |');
    lines.push('|------------------|-------|');
    for (const d of src.destinations) {
      lines.push(`| \`${d.tables.join('`, `')}\` | ${d.note} |`);
    }
    if (src.notes?.length) {
      lines.push('');
      for (const n of src.notes) lines.push(`- ${n}`);
    }
    lines.push('');
  }

  lines.push(
    '### Diagrama ER — correspondencia legacy → TNFG',
    '',
    'Vista entidad-relación: cómo cada origen se descompone en tablas del modelo normalizado.',
    '',
    '```mermaid',
    MIGRATION_ER_DIAGRAM_MERMAID,
    '```',
    '',
    '### Flujo visual (tblLeads → modelo)',
    '',
    '```mermaid',
    'flowchart LR',
    '  subgraph LEGACY["dbProduction (solo lectura)"]',
    '    TL[tblLeads ~189 cols]',
    '    GU[g_users]',
    '    LC[tblLeadComments]',
    '    REF[ref_* catálogos]',
    '  end',
    '',
    '  subgraph TNFG["TNFG"]',
    '    LEAD[lead + lead_* dominios]',
    '    CLI[client + lead_party]',
    '    USER[app_user + hierarchy]',
    '    CAT[ref_* normalizados]',
    '    NOTE[lead_note]',
    '    LOG[entity_log + log_detail]',
    '  end',
    '',
    '  TL --> LEAD',
    '  TL --> CLI',
    '  TL --> LOG',
    '  GU --> USER',
    '  LC --> NOTE',
    '  REF --> CAT',
    '  TL -.-> NOTE',
    '```',
    '',
    '> Detalle columna a columna: tblLeads (índice abajo) · g_users compensación: DealGoal → hr_deal_goal, DealGoalCustom → hr_deal_goal_custom, paylocityId → paylocity_id.',
    ''
  );

  return lines.join('\n');
}

module.exports = {
  MIGRATION_PIPELINE,
  MIGRATION_SOURCES,
  MIGRATION_CORRESPONDENCE_OVERVIEW,
  MIGRATION_ER_DIAGRAM_MERMAID,
  buildSourceCorrespondence,
  TBLLEADS_COLUMN_GROUPS,
  G_USERS_COLUMN_GROUPS,
  renderMarkdownFlowSection,
};
