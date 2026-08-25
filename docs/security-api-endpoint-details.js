/**
 * Contrato request/response por endpoint tnfg-security-api.
 * Clave: `${blockId}|${method}|${path}`
 */

const SECURITY_JWT = 'Header: Authorization: Bearer <security-jwt>';
const PORTAL_JWT = 'Header: Authorization: Bearer <portal-otp-jwt>';
const NONE = '(sin auth)';

const TOKEN_PAIR = `{
  accessToken: string,
  accessExpiresAt: string (ISO),
  refreshToken: string,
  refreshExpiresAt: string (ISO),
  sessionId?: string,
  userId: string,
  email: string
}`;

const DATA_LIST = (entity) => `{ data: ${entity}[] }`;

function c(request, response) {
  return { request, response };
}

const ENDPOINT_DETAILS = {
  // ——— Health ———
  'health|GET|': c(NONE, `{
  ok: true,
  service: "tnfg-security-api",
  intake_db: boolean,
  provision_intake: boolean
}`),

  // ——— Auth ———
  'auth|POST|otp/start': c(
    `Body: { email: string, clientId: string, userAgent?: string }
Header opcional: Idempotency-Key`,
    `{ ok: true }`,
  ),
  'auth|POST|otp/resend': c(
    `Body: { email: string, clientId: string, userAgent?: string }
Header opcional: Idempotency-Key`,
    `{ ok: true }`,
  ),
  'auth|POST|otp/verify': c(
    `Body: { email: string, clientId: string, code: string, userAgent?: string }`,
    TOKEN_PAIR,
  ),
  'auth|POST|refresh': c(
    `Body: { refreshToken: string, userAgent?: string }`,
    TOKEN_PAIR,
  ),
  'auth|POST|login': c(
    `Body: { email: string, password: string }`,
    TOKEN_PAIR,
  ),
  'auth|POST|set-password': c(
    `Body: { token: string, password: string }`,
    `{ ok: true, persona: Persona }`,
  ),
  'auth|GET|invite/check': c(
    `Query: token (string)`,
    `{ valid: true, email: string, display_name: string }`,
  ),

  // ——— Personas ———
  'personas|GET|': c(
    `Query: q?, kind?, limit?, offset?
${SECURITY_JWT}`,
    DATA_LIST(`Persona { id_persona, email, display_name, person_kind, is_active, … }`),
  ),
  'personas|GET|me': c(
    SECURITY_JWT,
    `Persona + ACL {
  id_persona, email, display_name, roles[], permissions[],
  acl: { [vistaCode]: actionCode[] }
}`,
  ),
  'personas|GET|:id': c(
    `Path: id (id_persona)
${SECURITY_JWT}`,
    `Persona { id_persona, email, display_name, person_kind, is_active, roles[], … }`,
  ),
  'personas|POST|': c(
    `Body: { email: string, display_name: string, person_kind?: "STAFF_INTERNO" | … }
${SECURITY_JWT}`,
    `Persona creada (201)`,
  ),
  'personas|PATCH|:id': c(
    `Path: id
Body: { display_name?, person_kind?, is_active? }
${SECURITY_JWT}`,
    `Persona actualizada`,
  ),
  'personas|GET|:id/access': c(
    `Path: id
${SECURITY_JWT}`,
    `{ sistemas: [{ id_sistema, system_code, role_ids[], attorney_ids[], tx_location_ids[] }] }`,
  ),
  'personas|PUT|:id/access/:idSistema': c(
    `Path: id, idSistema
Body: { role_ids?: number[], attorney_ids?: number[], tx_location_ids?: number[] }
${SECURITY_JWT}`,
    `Perfil de acceso portal actualizado`,
  ),
  'personas|PUT|:id/roles': c(
    `Path: id
Body: { role_ids: number[], id_sistema?: number }
${SECURITY_JWT}`,
    `{ role_ids: number[] }`,
  ),
  'personas|POST|:id/invite': c(
    `Path: id
Body: { kind?: string }
${SECURITY_JWT}`,
    `{ invite_token, email, expires_at } (201)`,
  ),
  'personas|POST|:id/provision': c(
    `Path: id
${SECURITY_JWT}`,
    `{ provisioned: true, id_user: number } — sincroniza app_user en TNFG_INTAKE`,
  ),

  // ——— RBAC ———
  'rbac|GET|sistemas': c(
    SECURITY_JWT,
    DATA_LIST(`Sistema { id_sistema, system_code, display_name, oauth_client_id, portal_application_id, is_active }`),
  ),
  'rbac|POST|sistemas': c(
    `Body: { system_code: string, display_name: string }
${SECURITY_JWT}`,
    `{ sistema: Sistema } (201)`,
  ),
  'rbac|GET|roles': c(
    `Query: id_sistema? (number)
${SECURITY_JWT}`,
    DATA_LIST(`Rol { id_rol, role_code, display_name, id_sistema, system_code }`),
  ),
  'rbac|POST|roles': c(
    `Body: { id_sistema: number, role_code: string, display_name: string }
${SECURITY_JWT}`,
    `{ role: Rol } (201)`,
  ),
  'rbac|GET|permisos': c(
    `Query: id_sistema? (number)
${SECURITY_JWT}`,
    DATA_LIST(`Permiso { id_permiso, permission_code, display_name, id_sistema, system_code }`),
  ),
  'rbac|GET|acciones': c(
    SECURITY_JWT,
    DATA_LIST(`Accion { id_accion, action_code, display_name, sort_order }`),
  ),
  'rbac|POST|acciones': c(
    `Body: { action_code: string, display_name: string, sort_order?: number }
${SECURITY_JWT}`,
    `{ accion: Accion } (201)`,
  ),
  'rbac|GET|vistas': c(
    `Query: id_sistema? (number)
${SECURITY_JWT}`,
    DATA_LIST(`Vista { id_vista, vista_code, display_name, route_path, sort_order, id_sistema, system_code }`),
  ),
  'rbac|POST|vistas': c(
    `Body: { id_sistema, vista_code, display_name, route_path?, sort_order?, parent_vista_id? }
${SECURITY_JWT}`,
    `{ vista: Vista } (201)`,
  ),
  'rbac|GET|roles/:id/acl-matrix': c(
    `Path: id (id_rol)
${SECURITY_JWT}`,
    `{ role, vistas[], acciones[], grants: { [vistaId]: { [accionId]: boolean } } }`,
  ),
  'rbac|PUT|roles/:id/acl-matrix': c(
    `Path: id
Body: { grants: { [vistaId]: { [accionId]: boolean } } }
${SECURITY_JWT}`,
    `{ grants: … }`,
  ),
  'rbac|PUT|roles/:id/permissions': c(
    `Path: id
Body: { permission_ids: number[] }
${SECURITY_JWT}`,
    `{ permission_ids: number[] }`,
  ),
  'rbac|GET|sistemas/:idSistema/email-domains': c(
    `Path: idSistema
${SECURITY_JWT}`,
    DATA_LIST(`EmailDomain { id_domain, domain, is_active, id_sistema }`),
  ),
  'rbac|POST|sistemas/:idSistema/email-domains': c(
    `Path: idSistema
Body: { domain: string }
${SECURITY_JWT}`,
    `{ domain: EmailDomain } (201)`,
  ),
  'rbac|PATCH|email-domains/:idDomain': c(
    `Path: idDomain
Body: { is_active: boolean }
${SECURITY_JWT}`,
    `{ domain: EmailDomain }`,
  ),

  // ——— Portal access ———
  'access|GET|me': c(
    PORTAL_JWT,
    `{ id_persona, email, scope: { attorney_ids[], tx_location_ids[], … } }`,
  ),
  'access|GET|me/attorneys': c(
    PORTAL_JWT,
    `number[] — IDs de attorneys visibles (o { ids: number[] } según Accept)`,
  ),
  'access|GET|me/txlocations': c(
    PORTAL_JWT,
    `number[] — IDs de tx locations visibles`,
  ),
  'access|GET|attorneys/:attorneyId/users': c(
    `Path: attorneyId
${PORTAL_JWT}`,
    `number[] — user IDs bajo ese attorney (403 → [])`,
  ),
  'access|GET|txlocations/:txLocationId/users': c(
    `Path: txLocationId
${PORTAL_JWT}`,
    `number[] — user IDs bajo esa tx location`,
  ),

  // ——— Access grants ———
  'access-grants|GET|catalogs': c(
    SECURITY_JWT,
    `{ hierarchy_levels[], companies[], offices[] }`,
  ),
  'access-grants|GET|intake-users': c(
    `Query: q?, limit?, offset?, active?, leaders_only?, level_code?
${SECURITY_JWT}`,
    `{ data: IntakeUser[], total: number }`,
  ),
  'access-grants|GET|': c(
    `Query: user_id?, active? (0|1), limit?, offset?
${SECURITY_JWT}`,
    `{ data: Grant[], total: number }`,
  ),
  'access-grants|GET|:id': c(
    `Path: id (grant_id)
${SECURITY_JWT}`,
    `Grant { grant_id, user_id, id_hierarchy_level, id_company_office, leader_user_id, access_level, valid_from, valid_to, is_active, … }`,
  ),
  'access-grants|POST|': c(
    `Body: {
  user_id: number (required),
  id_hierarchy_level: number (required),
  id_company_office?: number,
  leader_user_id?: number,
  access_level?: "VIEW" | "EDIT",
  can_export?: boolean,
  valid_from?, valid_to?, reason?
}
${SECURITY_JWT}`,
    `Grant creado (201)`,
  ),
  'access-grants|PATCH|:id': c(
    `Path: id
Body: { id_hierarchy_level?, id_company_office?, leader_user_id?, access_level?, valid_from?, valid_to?, is_active?, reason? }
${SECURITY_JWT}`,
    `Grant actualizado`,
  ),

  // ——— Portal catalog ———
  'portal-catalog|GET|attorneys': c(
    `Query: q?, ids? (comma-separated)
${SECURITY_JWT}`,
    DATA_LIST(`Attorney { id, name, … }`),
  ),
  'portal-catalog|GET|tx-locations': c(
    `Query: q?, ids?
${SECURITY_JWT}`,
    DATA_LIST(`TxLocation { id, name, … }`),
  ),

  // ——— Portal users ———
  'portal-users|GET|': c(
    `Query: search?, q?, limit?, page?
${PORTAL_JWT}`,
    `{ data: PortalUser[], page, total, … }`,
  ),

  // ——— Business rules ———
  'business-rules|GET|health': c(
    SECURITY_JWT,
    `{ ok: true, intake_db: boolean }`,
  ),
  'business-rules|GET|dimensions': c(
    SECURITY_JWT,
    DATA_LIST(`RuleDimension`),
  ),
  'business-rules|GET|log-statuses': c(
    SECURITY_JWT,
    DATA_LIST(`LogStatus { id, code, label, … }`),
  ),
  'business-rules|GET|log-status-rules': c(
    `Query: active? (1 = solo activas)
${SECURITY_JWT}`,
    DATA_LIST(`LogStatusRule`),
  ),
  'business-rules|POST|log-status-rules': c(
    `Body: campos de regla log status (dimensiones, prioridad, acción, …)
${SECURITY_JWT}`,
    `{ rule: LogStatusRule } (201)`,
  ),
  'business-rules|PATCH|log-status-rules/:id': c(
    `Path: id
Body: campos editables de la regla
${SECURITY_JWT}`,
    `{ rule: LogStatusRule }`,
  ),
  'business-rules|GET|log-status-overrides': c(
    `Query: active? (default activas)
${SECURITY_JWT}`,
    DATA_LIST(`LogStatusOverride`),
  ),
  'business-rules|PATCH|log-status-overrides/:id': c(
    `Path: id
Body: campos del override
${SECURITY_JWT}`,
    `{ rule: LogStatusOverride }`,
  ),
  'business-rules|GET|status-catalog': c(
    `Query: domain?
${SECURITY_JWT}`,
    DATA_LIST(`StatusCatalogEntry`),
  ),
  'business-rules|PATCH|status-catalog/:id': c(
    `Path: id
Body: campos del catálogo de estado
${SECURITY_JWT}`,
    `{ entry: StatusCatalogEntry }`,
  ),
  'business-rules|GET|cnv/states': c(
    SECURITY_JWT,
    DATA_LIST(`CnvState`),
  ),
  'business-rules|PATCH|cnv/states/:id': c(
    `Path: id
Body: campos del estado CNV
${SECURITY_JWT}`,
    `{ state: CnvState }`,
  ),
  'business-rules|GET|cnv/rules': c(
    `Query: active?
${SECURITY_JWT}`,
    DATA_LIST(`CnvRule`),
  ),
  'business-rules|PATCH|cnv/rules/:id': c(
    `Path: id
Body: campos de la regla CNV
${SECURITY_JWT}`,
    `{ rule: CnvRule }`,
  ),
  'business-rules|GET|special-list': c(
    SECURITY_JWT,
    `{ data: SpecialListEntry[] }`,
  ),
  'business-rules|POST|special-list': c(
    `Body: { id_lead?, reason?, … }
${SECURITY_JWT}`,
    `{ entry: SpecialListEntry } (201)`,
  ),
  'business-rules|PATCH|special-list/:id': c(
    `Path: id
Body: campos editables
${SECURITY_JWT}`,
    `{ entry: SpecialListEntry }`,
  ),
};

function endpointKey(blockId, method, path) {
  return `${blockId}|${method}|${path}`;
}

function defaultContract(block, ep) {
  const auth =
    block.auth === 'security-jwt'
      ? SECURITY_JWT
      : block.auth === 'portal-jwt'
        ? PORTAL_JWT
        : NONE;

  let request = auth;
  if (ep.method === 'GET') {
    if (ep.path.includes(':')) request += '\nPath params según ruta';
    if (ep.summary?.includes('(')) {
      const hint = ep.summary.match(/\(([^)]+)\)/)?.[1];
      if (hint) request += `\nQuery / filtros: ${hint}`;
    }
  } else if (['POST', 'PUT', 'PATCH'].includes(ep.method)) {
    if (ep.path.includes(':')) request += '\nPath params según ruta';
    request += '\nBody: JSON';
  }

  const response =
    ep.method === 'GET'
      ? '{ data: [...] } u objeto según módulo'
      : ep.method === 'POST'
        ? '{ entity } (201 Created)'
        : '{ entity }';

  return { request, response };
}

function enrichBlocks(blocks) {
  return blocks.map((block) => ({
    ...block,
    endpoints: block.endpoints.map((ep) => {
      const key = endpointKey(block.id, ep.method, ep.path);
      const detail = ENDPOINT_DETAILS[key] ?? defaultContract(block, ep);
      return { ...ep, ...detail };
    }),
  }));
}

module.exports = { ENDPOINT_DETAILS, enrichBlocks, endpointKey };
