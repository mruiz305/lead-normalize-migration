-- RBAC Security Admin: vistas para reglas de negocio (datos en TNFG).
-- Idempotente. Ejecutar en SECURITY_TNFG.

SET NAMES utf8mb4;

SET @tenant := 1;
SET @id_intake := (SELECT id_sistema FROM sistema WHERE id_tenant = @tenant AND system_code = 'INTAKE' LIMIT 1);

INSERT IGNORE INTO vista (id_tenant, id_sistema, vista_code, display_name, route_path, sort_order) VALUES
(@tenant, @id_intake, 'reglas_log',      'Reglas log status',     '/reglas/log',      120),
(@tenant, @id_intake, 'reglas_cnv',      'Reglas CNV',            '/reglas/cnv',      130),
(@tenant, @id_intake, 'catalogo_estado', 'Catálogo legal/clinical', '/reglas/catalogo', 140);

-- intake_director: ver + editar reglas
INSERT IGNORE INTO rol_vista_accion (id_rol, id_vista, id_accion)
SELECT r.id_rol, v.id_vista, a.id_accion
FROM rol r
CROSS JOIN vista v
CROSS JOIN accion a
WHERE r.role_code = 'intake_director'
  AND v.id_sistema = @id_intake
  AND v.vista_code IN ('reglas_log', 'reglas_cnv', 'catalogo_estado')
  AND a.action_code IN ('VER', 'EDITAR');

-- intake_system_admin: ADMIN en vistas de reglas
INSERT IGNORE INTO rol_vista_accion (id_rol, id_vista, id_accion)
SELECT r.id_rol, v.id_vista, a.id_accion
FROM rol r
CROSS JOIN vista v
CROSS JOIN accion a
WHERE r.role_code = 'intake_system_admin'
  AND v.id_sistema = @id_intake
  AND v.vista_code IN ('reglas_log', 'reglas_cnv', 'catalogo_estado')
  AND a.action_code = 'ADMIN';

-- Permisos flat legacy (opcional)
INSERT IGNORE INTO permiso (id_tenant, id_sistema, permission_code, display_name) VALUES
(@tenant, @id_intake, 'intake:rules:read',  'Ver reglas de negocio'),
(@tenant, @id_intake, 'intake:rules:write', 'Editar reglas de negocio');

INSERT IGNORE INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM rol r
CROSS JOIN permiso p
WHERE r.role_code IN ('intake_system_admin', 'intake_director')
  AND p.permission_code IN ('intake:rules:read', 'intake:rules:write');
