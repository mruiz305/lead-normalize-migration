/**
 * RBAC INTAKE — catálogo alineado con pantallas migradas (sin portal bridge).
 */

const INTAKE_SECURITY_META = {
  title: 'Intake Security — RBAC & ACL',
  subtitle: 'SECURITY_TNFG (id_sistema=INTAKE) — vistas = pantallas Case Manager / User Management',
  principle:
    'Matriz vista×acción usa el mismo lenguaje que el producto intake migrado. Sin auditoría, entity_log ni “reportes” genéricos. User Management cubre staff (no hay pantalla Directory separada en RBAC).',
  docs: [
    { label: 'SECURITY_INTAKE_PERMISOS.md', path: 'docs/SECURITY_INTAKE_PERMISOS.md' },
    { label: 'SECURITY_RBAC_CATALOGO.md', path: 'docs/SECURITY_RBAC_CATALOGO.md' },
    { label: 'tnfg-intake-api README — Auth', path: 'tnfg-intake-api/README.md#auth' },
  ],
  jwtFields: [
    { field: 'acl_intake', type: 'Record<vista, accion[]>', note: 'Claves = vista_code (case_manager, user_management, …)' },
    { field: 'permissions', type: 'string[]', note: 'Flat intake:* legacy + fallback portal' },
  ],
};

const INTAKE_SECURITY_SEEDS = [
  { script: 'security:seed:intake-rbac', sql: '03_seed_intake_rbac.sql', desc: 'permiso flat intake:* + roles intake_*' },
  { script: 'security:bootstrap:rbac-catalog', sql: '04 + 05', desc: 'vista + rol_vista_accion (instalación nueva)' },
  { script: 'security:align:intake-vistas', sql: '09_align_intake_vistas_ui.sql', desc: 'renombrar vistas en BD existente' },
  { script: 'security:assign:intake-roles', sql: '(JS)', desc: 'persona_rol INTAKE' },
];

const INTAKE_ROLES = [
  { code: 'intake_readonly', profile: 'Solo lectura', keyPerms: 'case_manager VER, catalogs VER' },
  { code: 'intake_submitter', profile: 'Submitter', keyPerms: 'new_lead CREAR, comments CREAR' },
  { code: 'intake_specialist', profile: 'Intake specialist', keyPerms: 'lead_status EDITAR' },
  { code: 'intake_leader', profile: 'Líder', keyPerms: 'transfer ASIGNAR, user_management VER, marketing' },
  { code: 'intake_director', profile: 'Director', keyPerms: 'grants EDITAR, user_management EDITAR' },
  { code: 'intake_system_admin', profile: 'Admin', keyPerms: 'ADMIN todas las vistas' },
];

const PORTAL_BRIDGE_ROLES = [];

const INTAKE_VISTAS = [
  { code: 'app', label: 'Login', route: '/signin' },
  { code: 'case_manager', label: 'Case Manager', route: 'operations/case-manager' },
  { code: 'new_lead', label: 'New Lead', route: 'operations/new-lead' },
  { code: 'lead_detail', label: 'Lead Detail', route: 'operations/case-manager/:idLead' },
  { code: 'transfer', label: 'Transfer', route: '.../transfer' },
  { code: 'edit_demographics', label: 'Edit Lead — Demographics', route: null },
  { code: 'edit_passengers', label: 'Edit Lead — Passengers', route: null },
  { code: 'comments', label: 'Comments & notes', route: null },
  { code: 'lead_status', label: 'Lead status change', route: null },
  { code: 'catalogs', label: 'Catalogs', route: '/catalog' },
  { code: 'user_management', label: 'User Management', route: 'user-management' },
  { code: 'grants', label: 'Grants', route: '/grants' },
  { code: 'marketing', label: 'Marketing (Home charts)', route: 'home-menu/case-manager' },
];

const INTAKE_API_ACL = [
  { routes: 'GET /case-manager/*', vista: 'case_manager', accion: 'VER', note: 'Listas ops' },
  { routes: 'POST /case-manager/leads', vista: 'new_lead', accion: 'CREAR', note: 'New Lead' },
  { routes: 'PATCH /case-manager/leads/:id', vista: 'lead_detail', accion: 'EDITAR', note: 'Edit Lead' },
  { routes: 'POST .../transfer', vista: 'transfer', accion: 'ASIGNAR', note: 'Transfer' },
  { routes: 'GET /case-manager/marketing', vista: 'marketing', accion: 'VER', note: 'Home charts' },
  { routes: '/cases/:id/comments', vista: 'comments', accion: 'VER/CREAR/EDITAR', note: 'Comentarios' },
  { routes: 'GET /catalog/*', vista: 'catalogs', accion: 'VER', note: 'Dropdowns Edit Lead (intake-api /catalog/*)' },
  { routes: '/user-management/*', vista: 'user_management', accion: 'VER/EDITAR', note: 'User Management grid + CRUD' },
  { routes: '/directory/*', vista: 'user_management', accion: 'VER', note: '1800 Directory (misma vista RBAC que UM)' },
  { routes: '/grants/*', vista: 'grants', accion: 'VER/EDITAR', note: 'Grants org' },
];

const INTAKE_SECURITY_STATS = {
  intakeRoles: INTAKE_ROLES.length,
  portalBridgeRoles: 0,
  vistas: INTAKE_VISTAS.length,
  apiAclRows: INTAKE_API_ACL.length,
  seedScripts: INTAKE_SECURITY_SEEDS.length,
};

module.exports = {
  INTAKE_SECURITY_META,
  INTAKE_SECURITY_SEEDS,
  INTAKE_ROLES,
  PORTAL_BRIDGE_ROLES,
  INTAKE_VISTAS,
  INTAKE_API_ACL,
  INTAKE_SECURITY_STATS,
};
