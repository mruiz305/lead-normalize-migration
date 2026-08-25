-- =============================================================================
-- SECURITY_TNFG — bridge portal ↔ intake (solo pantallas migradas a intake-api)
-- Idempotente. No otorga permisos doctor/lawyer, performance ni payments.
-- Aplicar: npm run security:seed:portal-intake-bridge
-- =============================================================================

SET NAMES utf8mb4;

SET @tenant := 1;
SET @id_portal := (
  SELECT id_sistema FROM sistema
  WHERE id_tenant = @tenant AND system_code = 'PORTAL_ABOGADOS' LIMIT 1
);

-- Permiso UM intake (no venía en sync identity legacy)
INSERT IGNORE INTO permiso (id_tenant, id_sistema, permission_code, display_name) VALUES
(@tenant, @id_portal, 'ui:cases:user_management:view', 'Ver User Management intake');

-- Roles portal mínimos para staff intake (sin case-service)
INSERT IGNORE INTO rol (id_tenant, id_sistema, role_code, display_name) VALUES
(@tenant, @id_portal, 'portal_intake_staff',       'Portal — Intake staff (leads)'),
(@tenant, @id_portal, 'portal_intake_user_admin',  'Portal — Intake + User Management'),
(@tenant, @id_portal, 'portal_intake_admin',       'Portal — Intake admin');

-- portal_intake_staff → ver case-manager en portal
INSERT IGNORE INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM rol r
JOIN permiso p ON p.id_tenant = @tenant AND p.permission_code = 'cases:read'
WHERE r.id_tenant = @tenant AND r.role_code = 'portal_intake_staff';

-- portal_intake_user_admin → leads + user management
INSERT IGNORE INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM rol r
JOIN permiso p ON p.id_tenant = @tenant AND p.permission_code IN (
  'cases:read',
  'ui:cases:user_management:view'
)
WHERE r.id_tenant = @tenant AND r.role_code = 'portal_intake_user_admin';

-- portal_intake_admin → bypass portal para intake (transfer, grants UI futura, marketing)
INSERT IGNORE INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM rol r
JOIN permiso p ON p.id_tenant = @tenant AND p.permission_code IN (
  'app:admin',
  'cases:read',
  'ui:cases:user_management:view'
)
WHERE r.id_tenant = @tenant AND r.role_code = 'portal_intake_admin';
