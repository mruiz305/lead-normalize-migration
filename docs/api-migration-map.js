/**
 * Mapa API case-service → tnfg-intake-api (contrato transparente Portal).
 * Fuente para Schema Dictionary React + docs/MIGRACION_API_ENTREGA_EQUIPO.md
 */

const { enrichBlocks } = require('./api-migration-endpoint-details');

const API_MIGRATION_META = {
  title: 'API Migration — case-service → intake-api',
  subtitle: 'Mismas rutas y JSON; cada equipo valida en su ambiente (host/puerto propios)',
  principle:
    'Reemplazar case-service por tnfg-intake-api sin cambios en código del Portal. Queries sobre TNFG (lead-normalize-migration), no dbProduction en runtime.',
  architecture: {
    before: 'Portal → case-service → dbProduction',
    after: 'Portal → tnfg-intake-api → TNFG_INTAKE',
  },
  envVars: [
    {
      name: 'VITE_USER_MANAGEMENT_SERVICE_URL',
      before: 'http://<case-service-host>',
      after: 'http://<intake-api-host>',
      scope: 'User Management /user-management/* + Directory /directory/*',
    },
    {
      name: 'VITE_CASE_MANAGER_SERVICE_URL',
      before: '(no en developer; fallback BACEND_CASE)',
      after: 'http://<intake-api-host>',
      scope: 'Case Manager /case-manager/*, catálogos /catalog/*, comentarios origin=case-manager',
    },
    {
      name: 'VITE_BACEND_CASE_SERVICE_URL',
      before: 'http://<case-service-host>',
      after: 'http://<case-service-host>/api',
      scope: 'Casos verificados /cases/*, dashboard, performance, payments; comentarios attorney/doctor',
    },
  ],
};

const API_MIGRATION_PROGRESS = [
  { id: 'data-um', label: 'Datos UM (catálogos + app_user FKs + deal goal + paylocity)', status: 'tested' },
  { id: 'api-um-read', label: 'API UM lectura (catalog + directory)', status: 'tested' },
  { id: 'api-um-write', label: 'API UM escritura (POST/PUT/term user)', status: 'tested' },
  {
    id: 'data-leads',
    label: 'Datos leads (migrate tblLeads) — corrida OK; re-sync incremental vs prod',
    status: 'tested',
  },
  { id: 'api-case-manager', label: 'API case-manager (23+ rutas; phone-conflict / conflict-case)', status: 'tested' },
  { id: 'api-case-catalog', label: 'API catalog CASE (11 rutas Edit Lead / chat)', status: 'tested' },
  { id: 'api-case-comments', label: 'API case comments (3 rutas; lead_note chat)', status: 'tested' },
  { id: 'security-provision', label: 'Provisioning tnfg-security en create user', status: 'tested' },
  { id: 'api-intake-tests', label: 'Tests automatizados intake-api (Jest, 57 rutas HTTP)', status: 'tested' },
  { id: 'intake-acl-guards', label: 'ACL INTAKE en controllers (IntakeAclGuard)', status: 'tested' },
  { id: 'portal-bridge-roles', label: 'Roles portal_intake_* + assign script', status: 'tested' },
  { id: 'portal-test-branch', label: 'Portal rama test-developer-tnfg (TNFG .env + marketing charts)', status: 'tested' },
  { id: 'portal-cutover', label: 'Corte Portal developer oficial (.env prod)', status: 'pending' },
];

/** @typedef {'tested'|'pending'|'future'} EndpointStatus */

const API_MIGRATION_BLOCKS = [
  {
    id: 'user-management',
    title: 'User Management',
    portalAxios: 'USER-MANAGEMENT',
    basePath: '/user-management',
    caseServiceRef: 'legacy/user-management-catalog.controller.ts (@Controller user-management)',
    intakeModule: 'user-management',
    endpoints: [
      { method: 'GET', path: 'user-list', status: 'tested', portal: 'Grid UM', legacy: 'g_users', tnfg: 'app_user' },
      { method: 'GET', path: 'user/:user_id', status: 'tested', portal: 'Edit UM', legacy: 'g_users + jerarquía', tnfg: 'app_user + hierarchy_membership' },
      { method: 'GET', path: 'teams', status: 'tested', portal: 'Create dropdown', legacy: 'g_users ∩ hierarchyTeam', tnfg: 'hierarchy_membership' },
      { method: 'GET', path: 'departments', status: 'tested', portal: 'Create dropdown', legacy: 'departments', tnfg: 'ref_department' },
      { method: 'GET', path: 'ranks', status: 'tested', portal: '(backend)', legacy: 'ranks', tnfg: 'ref_rank' },
      { method: 'GET', path: 'job-titles', status: 'tested', portal: 'Create dropdown', legacy: 'DISTINCT g_users.title', tnfg: 'ref_job_title' },
      { method: 'GET', path: 'contract-types', status: 'tested', portal: 'Create dropdown', legacy: 'contractType texto', tnfg: 'ref_ee_contract_type' },
      { method: 'GET', path: 'hr-statuses', status: 'tested', portal: 'Edit User HR Status', legacy: 'hrStatus texto', tnfg: 'ref_hr_status' },
      { method: 'GET', path: 'intake-roles', status: 'tested', portal: '(admin grants)', legacy: '—', tnfg: 'SECURITY roles INTAKE' },
      { method: 'POST', path: 'user', status: 'tested', portal: 'Create user', legacy: 'sp_insert_user + Glide', tnfg: 'app_user INSERT + security provision' },
      { method: 'PUT', path: 'user', status: 'tested', portal: '(UI pendiente)', legacy: 'sp_update_user', tnfg: 'app_user UPDATE' },
      { method: 'POST', path: 'user/:user_id/term', status: 'tested', portal: 'Term user (hrStatus=termed)', legacy: '—', tnfg: 'app_user Termed + user_hr_period' },
      { method: 'POST', path: 'rehire', status: 'tested', portal: 'Rehire user', legacy: '—', tnfg: 'app_user Active + user_hr_period' },
      { method: 'POST', path: 'offboard', status: 'tested', portal: 'Offboard user', legacy: '—', tnfg: 'app_user Termed + user_hr_period' },
      { method: 'POST', path: 'orientation-change', status: 'tested', portal: 'Change team leader / orientation', legacy: 'hierarchyTeam', tnfg: 'hierarchy_membership' },
      { method: 'PUT', path: 'user-information', status: 'tested', portal: 'Perfil público', legacy: 'g_users picture/redes', tnfg: 'app_user + user_channel' },
    ],
  },
  {
    id: 'directory',
    title: '1800 Directory',
    portalAxios: 'USER-MANAGEMENT',
    basePath: '/directory',
    caseServiceRef: 'legacy/user-directory.controller.ts (@Controller directory)',
    intakeModule: 'directory',
    endpoints: [
      { method: 'GET', path: 'departments', status: 'tested', portal: '1800 Directory secciones', legacy: 'DISTINCT systemDepartment', tnfg: 'ref_department' },
      { method: 'GET', path: 'user-list', status: 'tested', portal: 'Directory listado', legacy: 'g_users', tnfg: 'app_user + JOINs' },
    ],
  },
  {
    id: 'case-manager',
    title: 'Case Manager — Leads',
    portalAxios: 'CASE-MANAGER',
    basePath: '/case-manager',
    caseServiceRef: 'case-manager.controller.ts',
    intakeModule: 'case-manager',
    endpoints: [
      { method: 'GET', path: 'active-leads/count', status: 'tested', portal: 'Home badge', legacy: 'tblLeads + jerarquía', tnfg: 'lead + scope membership' },
      { method: 'GET', path: 'leads', status: 'tested', portal: 'Active Leads / Home drill-down', legacy: 'tblLeads', tnfg: 'lead + client + status (+ period/periodValue)' },
      { method: 'GET', path: 'leads/:idLead', status: 'tested', portal: 'Detalle lead', legacy: 'tblLeads wide', tnfg: 'lead + dominios' },
      { method: 'POST', path: 'leads', status: 'tested', portal: 'New Lead', legacy: 'INSERT tblLeads', tnfg: 'lead + client + party + lead_org_snapshot + notes (+ tblLeadConflictCase si conflictLeadId)' },
      { method: 'GET', path: 'leads/phone-conflict', status: 'tested', portal: 'New Lead phone check', legacy: 'tblLeads phone window', tnfg: 'client_channel + lead (15 días, != Dropped)' },
      { method: 'GET', path: 'leads/:idLead/conflict-case', status: 'tested', portal: 'Detalle / status change gates', legacy: 'tblLeadConflictCase', tnfg: 'tblLeadConflictCase + lead + status' },
      { method: 'PATCH', path: 'leads/:idLead', status: 'tested', portal: 'Edit Lead Save (all sections)', legacy: '— (no PATCH)', tnfg: 'client + accident + legal + clinical + injury + insurance + notes' },
      { method: 'PATCH', path: 'leads/:idLead/accident-notes', status: 'tested', portal: 'Detalle', legacy: 'accidentNotes', tnfg: 'lead_note accident' },
      { method: 'POST', path: 'leads/:idLead/transfer', status: 'tested', portal: 'Transfer', legacy: 'UPDATE submitter', tnfg: 'submitter_user_id + lead_staff + lead_org_snapshot' },
      { method: 'GET', path: 'marketing-reps', status: 'tested', portal: 'Transfer dropdown', legacy: 'g_users Marketing', tnfg: 'app_user + ref_department' },
      { method: 'GET', path: 'transfer-rep-detail/:userId', status: 'tested', portal: 'Transfer preview', legacy: 'g_users', tnfg: 'app_user + hierarchy' },
      { method: 'GET', path: 'search-leads', status: 'pending', portal: 'Search Leads combobox (portal-mf-intake)', legacy: 'tblLeads search', tnfg: 'Pendiente en intake-api (portal ya llama la ruta)' },
      { method: 'GET', path: 'locked-down-today', status: 'tested', portal: 'Ops', legacy: 'vista lockdown', tnfg: 'lead + timeline' },
      { method: 'GET', path: 'pending-to-sign', status: 'tested', portal: 'Ops', legacy: 'pending sign', tnfg: 'lead status' },
      { method: 'GET', path: 'pending-to-sign/count', status: 'tested', portal: 'Counter', legacy: 'COUNT', tnfg: 'COUNT' },
      { method: 'GET', path: 'lock-down-drops', status: 'tested', portal: 'Ops', legacy: 'drops', tnfg: 'lead' },
      { method: 'GET', path: 'lock-down-drops/count', status: 'tested', portal: 'Counter', legacy: 'COUNT', tnfg: 'COUNT' },
      { method: 'GET', path: 'individual-ld-drops', status: 'tested', portal: 'Ops individual', legacy: 'submitter email', tnfg: 'submitter_user_id' },
      { method: 'GET', path: 'individual-ld-drops/count', status: 'tested', portal: 'Counter', legacy: 'COUNT', tnfg: 'COUNT' },
      { method: 'GET', path: 'individual-pending-to-sign', status: 'tested', portal: 'Ops individual', legacy: 'submitter', tnfg: 'submitter_user_id' },
      { method: 'GET', path: 'individual-pending-to-sign/count', status: 'tested', portal: 'Counter', legacy: 'COUNT', tnfg: 'COUNT' },
      { method: 'GET', path: 'my-dropped-leads', status: 'tested', portal: 'My dropped', legacy: 'Dropped + submitter', tnfg: 'lead + status' },
      { method: 'GET', path: 'hot-leads', status: 'tested', portal: 'Hot leads', legacy: 'isHotLead', tnfg: 'lead.is_hot_lead' },
      { method: 'GET', path: 'marketing', status: 'tested', portal: 'Home Marketing Charts', legacy: 'tblLeads GROUP BY', tnfg: 'lead + org_snapshot + timeline' },
    ],
  },
  {
    id: 'case-catalog',
    title: 'Case Catalog — Edit Lead / New Lead',
    portalAxios: 'CASE-MANAGER',
    basePath: '/catalog',
    caseServiceRef: 'case-catalog.controller.ts (case-service); mismo path en intake-api :3020',
    intakeModule: 'case-catalog',
    endpoints: [
      { method: 'GET', path: 'ref-states-legacy', status: 'tested', portal: 'New Lead estados', legacy: 'refStates', tnfg: 'ref_state is_active=1' },
      { method: 'GET', path: 'insurance?type=', status: 'tested', portal: 'Edit Lead Insurance', legacy: 'refInsurance', tnfg: 'ref_insurance_carrier PIP/AT_FAULT' },
      { method: 'GET', path: 'tx-locations?state=&status=', status: 'tested', portal: 'Edit Lead Treatment', legacy: 'refTXLocations', tnfg: 'ref_tx_location + ref_state' },
      { method: 'GET', path: 'attorneys?state=&status=', status: 'tested', portal: 'Edit Lead Attorney', legacy: 'refAttorneys', tnfg: 'ref_attorney + ref_state' },
      { method: 'GET', path: 'severity-levels?type=', status: 'tested', portal: 'Edit Lead Injury & Damage', legacy: 'hardcode Portal', tnfg: 'ref_severity_level portal labels' },
      { method: 'GET', path: 'injury-sites', status: 'tested', portal: 'Edit Lead Injuries', legacy: 'hardcode Portal', tnfg: 'ref_injury_site portal_sort_order' },
      { method: 'GET', path: 'at-fault-types', status: 'tested', portal: 'Edit Lead Accident', legacy: 'refAtFaultTypes', tnfg: 'ref_at_fault_type' },
      { method: 'GET', path: 'accident-or-wc', status: 'tested', portal: 'Edit Lead Intake (Accident vs WC)', legacy: 'accidentOrWC texto', tnfg: 'ref_accident_or_wc' },
      { method: 'GET', path: 'lead-statuses', status: 'tested', portal: 'Edit Lead header status', legacy: 'refLeadStatus', tnfg: 'refLeadStatus + portal_tab_scope' },
      { method: 'GET', path: 'languages', status: 'tested', portal: 'Edit Lead Demographics', legacy: 'language texto', tnfg: 'ref_language' },
      { method: 'GET', path: 'comment-sources', status: 'tested', portal: 'Chat badges origen', legacy: '—', tnfg: 'ref_comment_source' },
    ],
  },
  {
    id: 'case-comments',
    title: 'Case Comments',
    portalAxios: 'CASE / CASE-MANAGER',
    basePath: '/cases/:caseId/comments',
    caseServiceRef: 'case-comments (case-service)',
    intakeModule: 'case-comments',
    endpoints: [
      { method: 'GET', path: '', status: 'tested', portal: 'Hilo comentarios', legacy: 'tblLeadComments / case_comment', tnfg: 'lead_note comment' },
      { method: 'POST', path: '', status: 'tested', portal: 'Nuevo comentario', legacy: 'INSERT comment', tnfg: 'lead_note + document_id' },
      { method: 'PATCH', path: ':commentId', status: 'tested', portal: 'Editar comentario', legacy: 'UPDATE comment', tnfg: 'lead_note comment' },
    ],
  },
];

const API_MIGRATION_DIFFS = [
  { topic: 'Create user', legacy: 'Glide + sp_insert_user', tnfg: 'Glide (temporal) + app_user INSERT; legacy_row_id = Glide $rowID' },
  { topic: 'rank / title / department', legacy: 'Texto en g_users', tnfg: 'FK id_rank, id_job_title, id_department' },
  { topic: 'Auth UM', legacy: 'UI_CASES_USER_MANAGEMENT', tnfg: 'acl_intake.usuarios + ui:cases:user_management:view' },
  { topic: 'Auth Case Manager', legacy: 'cases:read / app:admin', tnfg: 'acl_intake (leads, lead_detalle, lead_notas) + portal_intake_* bridge' },
  {
    topic: 'Comentarios lead (chat unificado)',
    legacy: 'case_comment (Portal DB) / tblLeadComments',
    tnfg:
      'lead_note note_type=comment + source (origin[:status]) + mentions + recipient_user_ids; ver LEAD_NOTE_CHAT_PAUTAS.md',
  },
  {
    topic: 'Edit Lead demographics (city/state)',
    legacy: 'tblLeads street/city/residencyState/zipCode',
    tnfg:
      'client_address RESIDENCE con is_primary=1, is_active=1; GET devuelve residencyState como state_code (ej. FL)',
  },
  {
    topic: 'Accident vs Workers Comp',
    legacy: 'lead.accidentOrWC texto libre',
    tnfg: 'ref_accident_or_wc + GET /catalog/accident-or-wc',
  },
  {
    topic: 'HR Status User Management',
    legacy: 'g_users.hrStatus texto',
    tnfg: 'ref_hr_status + GET /user-management/hr-statuses',
  },
  {
    topic: 'Deal goal / compensación',
    legacy: 'g_users.DealGoal + DealGoalCustom (+ hrDealGoal casi vacío)',
    tnfg:
      'app_user.hr_deal_goal ← COALESCE(DealGoal, hrDealGoal); hr_deal_goal_custom ← DealGoalCustom; backfill npm run backfill:app-user-deal-paylocity',
  },
  {
    topic: 'Paylocity / payroll join',
    legacy: 'g_users.paylocityId',
    tnfg: 'app_user.paylocity_id (índice idx_app_user_paylocity_id) — API intake pendiente exponer',
  },
  { topic: 'New Lead idLead', legacy: 'AUTO_INCREMENT tblLeads', tnfg: 'lead.id_lead AUTO_INCREMENT (post-migración MAX+1)' },
  {
    topic: 'UM / Directory rutas',
    legacy: 'intake-api v1: /user-management/catalog/* y /user-management/directory/*',
    tnfg: '/user-management/* y /directory/* (case-service developer, PR #222–226)',
  },
  {
    topic: 'Edit Lead PATCH/GET',
    legacy: 'case-service sin PATCH; intake-api v1 DTO anidado',
    tnfg: 'JSON plano Portal (leadStatus, doa, firstName…) vía mappers lead-detail-portal / update-lead-portal',
  },
  {
    topic: 'Phone / conflict case',
    legacy: 'tblLeads phone + tblLeadConflictCase (ops legacy)',
    tnfg:
      'GET /case-manager/leads/phone-conflict + GET .../conflict-case; createLead escribe lead_org_snapshot y puede linkear tblLeadConflictCase',
  },
  {
    topic: 'Search Leads',
    legacy: 'case-service / portal search',
    tnfg: 'Portal llama GET /case-manager/search-leads — endpoint pendiente en tnfg-intake-api',
  },
];

module.exports = {
  API_MIGRATION_META,
  API_MIGRATION_PROGRESS,
  API_MIGRATION_BLOCKS: enrichBlocks(API_MIGRATION_BLOCKS),
  API_MIGRATION_DIFFS,
};
