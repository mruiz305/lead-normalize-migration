-- =============================================================================
-- SECURITY_TNFG — seed RBAC INTAKE (id_sistema = INTAKE)
-- Idempotente: INSERT IGNORE / no borra permisos portal.
-- Aplicar: npm run security:seed:intake-rbac
-- =============================================================================

SET NAMES utf8mb4;

SET @tenant := 1;
SET @id_intake := (SELECT id_sistema FROM sistema WHERE id_tenant = @tenant AND system_code = 'INTAKE' LIMIT 1);

-- ── Permisos ────────────────────────────────────────────────────────────────

INSERT IGNORE INTO permiso (id_tenant, id_sistema, permission_code, display_name) VALUES
(@tenant, @id_intake, 'intake:app:login',           'Acceder a intake'),
(@tenant, @id_intake, 'intake:app:admin',           'Administrador intake'),
(@tenant, @id_intake, 'intake:leads:read',          'Ver leads'),
(@tenant, @id_intake, 'intake:leads:create',        'Crear leads'),
(@tenant, @id_intake, 'intake:leads:edit',          'Editar leads'),
(@tenant, @id_intake, 'intake:leads:void',          'Anular leads'),
(@tenant, @id_intake, 'intake:leads:assign',        'Reasignar leads'),
(@tenant, @id_intake, 'intake:leads:export',        'Exportar listado leads'),
(@tenant, @id_intake, 'intake:clients:read',        'Ver clientes y partes'),
(@tenant, @id_intake, 'intake:clients:edit',        'Editar clientes y partes'),
(@tenant, @id_intake, 'intake:notes:read',          'Ver notas'),
(@tenant, @id_intake, 'intake:notes:create',        'Crear notas'),
(@tenant, @id_intake, 'intake:notes:edit',          'Editar notas'),
(@tenant, @id_intake, 'intake:status:change',       'Cambiar estado lead'),
(@tenant, @id_intake, 'intake:catalogs:read',       'Ver catálogos'),
(@tenant, @id_intake, 'intake:catalogs:edit',       'Editar catálogos'),
(@tenant, @id_intake, 'intake:users:read',          'Ver staff'),
(@tenant, @id_intake, 'intake:users:manage',        'Administrar staff'),
(@tenant, @id_intake, 'intake:grants:manage',       'Administrar grants org'),
(@tenant, @id_intake, 'intake:reports:export',      'Exportar reportes'),
(@tenant, @id_intake, 'intake:audit:view',          'Ver auditoría migración'),
(@tenant, @id_intake, 'intake:entity_log:read',     'Ver entity log (I/U/D)');

-- ── Roles ───────────────────────────────────────────────────────────────────

INSERT IGNORE INTO rol (id_tenant, id_sistema, role_code, display_name) VALUES
(@tenant, @id_intake, 'intake_system_admin', 'Intake — System Admin'),
(@tenant, @id_intake, 'intake_director',     'Intake — Director'),
(@tenant, @id_intake, 'intake_leader',       'Intake — Líder pod/team'),
(@tenant, @id_intake, 'intake_submitter',    'Intake — Submitter'),
(@tenant, @id_intake, 'intake_specialist',   'Intake — Intake Specialist'),
(@tenant, @id_intake, 'intake_readonly',     'Intake — Solo lectura');

-- Helper: permiso id por code
-- (MySQL 8 — variables en subqueries limitadas; usamos JOINs directos abajo)

-- intake_readonly
INSERT IGNORE INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM rol r
JOIN permiso p ON p.id_tenant = @tenant AND p.permission_code IN (
  'intake:app:login','intake:leads:read','intake:clients:read','intake:notes:read','intake:catalogs:read'
)
WHERE r.id_tenant = @tenant AND r.role_code = 'intake_readonly';

-- intake_submitter
INSERT IGNORE INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM rol r
JOIN permiso p ON p.id_tenant = @tenant AND p.permission_code IN (
  'intake:app:login','intake:leads:read','intake:leads:create','intake:leads:edit',
  'intake:clients:read','intake:clients:edit','intake:notes:read','intake:notes:create','intake:catalogs:read'
)
WHERE r.id_tenant = @tenant AND r.role_code = 'intake_submitter';

-- intake_specialist
INSERT IGNORE INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM rol r
JOIN permiso p ON p.id_tenant = @tenant AND p.permission_code IN (
  'intake:app:login','intake:leads:read','intake:leads:edit','intake:leads:export',
  'intake:clients:read','intake:clients:edit',
  'intake:notes:read','intake:notes:create','intake:notes:edit',
  'intake:status:change','intake:catalogs:read'
)
WHERE r.id_tenant = @tenant AND r.role_code = 'intake_specialist';

-- intake_leader
INSERT IGNORE INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM rol r
JOIN permiso p ON p.id_tenant = @tenant AND p.permission_code IN (
  'intake:app:login','intake:leads:read','intake:leads:create','intake:leads:edit',
  'intake:leads:export','intake:leads:assign',
  'intake:clients:read','intake:clients:edit',
  'intake:notes:read','intake:notes:create','intake:notes:edit',
  'intake:status:change','intake:catalogs:read','intake:users:read'
)
WHERE r.id_tenant = @tenant AND r.role_code = 'intake_leader';

-- intake_leader — entity log read
INSERT IGNORE INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM rol r
JOIN permiso p ON p.id_tenant = @tenant AND p.permission_code = 'intake:entity_log:read'
WHERE r.id_tenant = @tenant AND r.role_code = 'intake_leader';

-- intake_director
INSERT IGNORE INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM rol r
JOIN permiso p ON p.id_tenant = @tenant AND p.permission_code IN (
  'intake:app:login','intake:leads:read','intake:leads:create','intake:leads:edit',
  'intake:leads:void','intake:leads:export','intake:leads:assign',
  'intake:clients:read','intake:clients:edit',
  'intake:notes:read','intake:notes:create','intake:notes:edit',
  'intake:status:change','intake:catalogs:read','intake:catalogs:edit',
  'intake:users:read','intake:grants:manage',
  'intake:reports:export','intake:audit:view','intake:entity_log:read'
)
WHERE r.id_tenant = @tenant AND r.role_code = 'intake_director';

-- intake_system_admin → todos los permisos intake
INSERT IGNORE INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM rol r
JOIN permiso p ON p.id_tenant = @tenant AND p.id_sistema = @id_intake
WHERE r.id_tenant = @tenant AND r.role_code = 'intake_system_admin';
