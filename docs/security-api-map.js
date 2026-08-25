/**
 * Catálogo HTTP tnfg-security-api (NestJS).
 * Fuente: controllers NestJS en tnfg-security/api + panel Security API del diccionario.
 */

const { enrichBlocks } = require('./security-api-endpoint-details');

const SECURITY_API_META = {
  title: 'TNFG Security API',
  subtitle: 'NestJS + TypeScript · SECURITY_TNFG · puerto local 3001',
  principle:
    'Identidad central, OTP, RBAC y reglas de negocio. Rutas duales: /{módulo} y /api/{módulo} (excepto GET /health).',
  baseUrl: {
    local: 'http://localhost:3001',
    swagger: 'http://localhost:3001/api/docs',
  },
  clients: [
    { id: 'portal', label: 'Portal abogados', env: 'VITE_BACKEND_IDENTITY_SERVICE=http://localhost:3001/api' },
    { id: 'admin', label: 'Security Admin', env: 'VITE_API_URL=http://localhost:3001/api' },
    { id: 'intake-api', label: 'tnfg-intake-api', note: 'JWT validate + POST /api/personas provision' },
  ],
  authModes: [
    { id: 'none', label: 'Público' },
    { id: 'security-jwt', label: 'JWT Security (admin / staff)' },
    { id: 'portal-jwt', label: 'JWT Portal (OTP)' },
  ],
};

const SECURITY_API_BLOCKS = [
  {
    id: 'health',
    title: 'Health',
    basePath: '/health',
    dualRoute: false,
    auth: 'none',
    consumer: 'ops',
    description: 'Liveness + estado INTAKE DB opcional.',
    endpoints: [
      { method: 'GET', path: '', summary: 'ok, service, intake_db, provision_intake' },
    ],
  },
  {
    id: 'auth',
    title: 'Auth',
    basePath: '/api/auth',
    dualRoute: true,
    auth: 'none',
    consumer: 'portal, admin',
    description: 'OTP email (Portal + Admin) y login password legacy opcional.',
    endpoints: [
      { method: 'POST', path: 'otp/start', summary: 'Enviar código OTP (clientId + email)' },
      { method: 'POST', path: 'otp/resend', summary: 'Reenviar OTP' },
      { method: 'POST', path: 'otp/verify', summary: 'Verificar código → access + refresh token' },
      { method: 'POST', path: 'refresh', summary: 'Renovar access token' },
      { method: 'POST', path: 'login', summary: 'Login password (legacy staff con credencial)' },
      { method: 'POST', path: 'set-password', summary: 'Activar cuenta desde invitación' },
      { method: 'GET', path: 'invite/check', summary: 'Validar token de invitación' },
    ],
  },
  {
    id: 'personas',
    title: 'Personas (identidad)',
    basePath: '/api/personas',
    dualRoute: true,
    auth: 'security-jwt',
    consumer: 'admin, intake-api',
    description: 'CRUD persona, roles, acceso por sistema, invitación y provision intake.',
    endpoints: [
      { method: 'GET', path: '', summary: 'Listar personas (q, kind, paginación)' },
      { method: 'GET', path: 'me', summary: 'Perfil + ACL del JWT actual' },
      { method: 'GET', path: ':id', summary: 'Detalle persona' },
      { method: 'POST', path: '', summary: 'Crear persona' },
      { method: 'PATCH', path: ':id', summary: 'Actualizar display_name, kind, is_active' },
      { method: 'GET', path: ':id/access', summary: 'Accesos portal por sistema' },
      { method: 'PUT', path: ':id/access/:idSistema', summary: 'Recursos/roles de acceso portal' },
      { method: 'PUT', path: ':id/roles', summary: 'Asignar roles RBAC' },
      { method: 'POST', path: ':id/invite', summary: 'Enviar invitación activación' },
      { method: 'POST', path: ':id/provision', summary: 'Sincronizar app_user en TNFG_INTAKE' },
    ],
  },
  {
    id: 'rbac',
    title: 'RBAC catalog',
    basePath: '/api/rbac',
    dualRoute: true,
    auth: 'security-jwt',
    consumer: 'admin',
    description: 'Sistemas, roles, vistas, acciones, permisos flat y dominios OTP.',
    endpoints: [
      { method: 'GET', path: 'sistemas', summary: 'Listar aplicaciones (sistema)' },
      { method: 'POST', path: 'sistemas', summary: 'Alta sistema' },
      { method: 'GET', path: 'roles', summary: 'Roles por id_sistema' },
      { method: 'POST', path: 'roles', summary: 'Crear rol' },
      { method: 'GET', path: 'permisos', summary: 'Catálogo permisos flat' },
      { method: 'GET', path: 'acciones', summary: 'Catálogo acciones' },
      { method: 'POST', path: 'acciones', summary: 'Crear acción' },
      { method: 'GET', path: 'vistas', summary: 'Vistas por sistema' },
      { method: 'POST', path: 'vistas', summary: 'Crear vista' },
      { method: 'GET', path: 'roles/:id/acl-matrix', summary: 'Matriz vista × acción del rol' },
      { method: 'PUT', path: 'roles/:id/acl-matrix', summary: 'Actualizar matriz ACL' },
      { method: 'PUT', path: 'roles/:id/permissions', summary: 'Permisos flat del rol' },
      { method: 'GET', path: 'sistemas/:idSistema/email-domains', summary: 'Dominios OTP permitidos' },
      { method: 'POST', path: 'sistemas/:idSistema/email-domains', summary: 'Agregar dominio' },
      { method: 'PATCH', path: 'email-domains/:idDomain', summary: 'Activar/desactivar dominio' },
    ],
  },
  {
    id: 'access',
    title: 'Portal access scope',
    basePath: '/api/access',
    dualRoute: true,
    auth: 'portal-jwt',
    consumer: 'portal',
    description: 'Scope del usuario portal: attorneys, tx locations, usuarios por recurso.',
    endpoints: [
      { method: 'GET', path: 'me', summary: 'Perfil + scope del token portal' },
      { method: 'GET', path: 'me/attorneys', summary: 'Attorneys visibles' },
      { method: 'GET', path: 'me/txlocations', summary: 'Tx locations visibles' },
      { method: 'GET', path: 'attorneys/:attorneyId/users', summary: 'Usuarios de un attorney' },
      { method: 'GET', path: 'txlocations/:txLocationId/users', summary: 'Usuarios de una tx location' },
    ],
  },
  {
    id: 'access-grants',
    title: 'Temporary Access (grants)',
    basePath: '/api/access-grants',
    dualRoute: true,
    auth: 'security-jwt',
    consumer: 'admin',
    description: 'user_access_grant — acceso temporal fuera de jerarquía (Intake admin).',
    endpoints: [
      { method: 'GET', path: 'catalogs', summary: 'Niveles, companies, offices' },
      { method: 'GET', path: 'intake-users', summary: 'Buscar app_user / líderes de scope' },
      { method: 'GET', path: '', summary: 'Listar grants (filtros user_id, active)' },
      { method: 'GET', path: ':id', summary: 'Detalle grant' },
      { method: 'POST', path: '', summary: 'Crear grant temporal' },
      { method: 'PATCH', path: ':id', summary: 'Actualizar nivel, fechas, is_active' },
    ],
  },
  {
    id: 'portal-catalog',
    title: 'Portal catalog',
    basePath: '/api/portal',
    dualRoute: true,
    auth: 'security-jwt',
    consumer: 'admin',
    description: 'Catálogos attorneys y tx-locations desde TNFG_INTAKE.',
    endpoints: [
      { method: 'GET', path: 'attorneys', summary: 'Listado attorneys' },
      { method: 'GET', path: 'tx-locations', summary: 'Listado tx locations' },
    ],
  },
  {
    id: 'portal-users',
    title: 'Portal users',
    basePath: '/api/users',
    dualRoute: true,
    auth: 'portal-jwt',
    consumer: 'portal',
    description: 'Directorio de usuarios portal (token OTP).',
    endpoints: [{ method: 'GET', path: '', summary: 'Listar usuarios portal visibles' }],
  },
  {
    id: 'business-rules',
    title: 'Business rules',
    basePath: '/api/business-rules',
    dualRoute: true,
    auth: 'security-jwt',
    consumer: 'admin',
    description: 'Reglas log status, CNV, special list — datos en TNFG_INTAKE.',
    endpoints: [
      { method: 'GET', path: 'health', summary: 'Conectividad intake DB' },
      { method: 'GET', path: 'dimensions', summary: 'Dimensiones reglas log' },
      { method: 'GET', path: 'log-statuses', summary: 'Catálogo ref_log_status' },
      { method: 'GET', path: 'log-status-rules', summary: 'Reglas log status' },
      { method: 'POST', path: 'log-status-rules', summary: 'Crear regla' },
      { method: 'PATCH', path: 'log-status-rules/:id', summary: 'Editar regla' },
      { method: 'GET', path: 'log-status-overrides', summary: 'Overrides por lead' },
      { method: 'PATCH', path: 'log-status-overrides/:id', summary: 'Editar override' },
      { method: 'GET', path: 'status-catalog', summary: 'Catálogo estados lead' },
      { method: 'PATCH', path: 'status-catalog/:id', summary: 'Editar estado catálogo' },
      { method: 'GET', path: 'cnv/states', summary: 'Estados CNV' },
      { method: 'PATCH', path: 'cnv/states/:id', summary: 'Editar estado CNV' },
      { method: 'GET', path: 'cnv/rules', summary: 'Reglas CNV' },
      { method: 'PATCH', path: 'cnv/rules/:id', summary: 'Editar regla CNV' },
      { method: 'GET', path: 'special-list', summary: 'Special list leads' },
      { method: 'POST', path: 'special-list', summary: 'Alta special list' },
      { method: 'PATCH', path: 'special-list/:id', summary: 'Editar special list' },
    ],
  },
];

function countEndpoints(blocks) {
  return blocks.reduce((n, b) => n + b.endpoints.length, 0);
}

module.exports = {
  SECURITY_API_META,
  SECURITY_API_BLOCKS: enrichBlocks(SECURITY_API_BLOCKS),
  SECURITY_API_STATS: {
    modules: SECURITY_API_BLOCKS.length,
    operations: countEndpoints(SECURITY_API_BLOCKS),
    dualRouteModules: SECURITY_API_BLOCKS.filter((b) => b.dualRoute !== false).length,
  },
};
