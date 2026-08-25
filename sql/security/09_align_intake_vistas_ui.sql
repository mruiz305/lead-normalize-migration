-- =============================================================================
-- Alinear catálogo vistas INTAKE con pantallas reales (Case Manager, User Management…)
-- Quita auditoría / entity_log (sin UI). Renombra slugs para JWT acl_intake.
-- Idempotente. local/dev: npm run security:align:intake-vistas
-- =============================================================================

SET NAMES utf8mb4;

SET @tenant := 1;
SET @id_intake := (
  SELECT id_sistema FROM sistema WHERE id_tenant = @tenant AND system_code = 'INTAKE' LIMIT 1
);

-- Quitar vistas sin pantalla en intake migrado
DELETE rva FROM rol_vista_accion rva
JOIN vista v ON v.id_vista = rva.id_vista
WHERE v.id_sistema = @id_intake AND v.vista_code IN ('auditoria', 'entity_log');

DELETE FROM vista
WHERE id_sistema = @id_intake AND vista_code IN ('auditoria', 'entity_log');

-- Renombrar slugs + etiquetas = lenguaje del producto (inglés, como el portal)
UPDATE vista SET
  vista_code = 'case_manager',
  display_name = 'Case Manager',
  route_path = 'operations/case-manager',
  sort_order = 10
WHERE id_sistema = @id_intake AND vista_code = 'leads';

UPDATE vista SET
  vista_code = 'lead_detail',
  display_name = 'Lead Detail',
  route_path = 'operations/case-manager/:idLead',
  sort_order = 20
WHERE id_sistema = @id_intake AND vista_code = 'lead_detalle';

UPDATE vista SET
  vista_code = 'edit_demographics',
  display_name = 'Edit Lead — Demographics',
  route_path = NULL,
  sort_order = 30
WHERE id_sistema = @id_intake AND vista_code = 'lead_cliente';

UPDATE vista SET
  vista_code = 'edit_passengers',
  display_name = 'Edit Lead — Passengers',
  route_path = NULL,
  sort_order = 40
WHERE id_sistema = @id_intake AND vista_code = 'lead_partes';

UPDATE vista SET
  vista_code = 'comments',
  display_name = 'Comments & notes',
  route_path = NULL,
  sort_order = 50
WHERE id_sistema = @id_intake AND vista_code = 'lead_notas';

UPDATE vista SET
  vista_code = 'lead_status',
  display_name = 'Lead status change',
  route_path = NULL,
  sort_order = 60
WHERE id_sistema = @id_intake AND vista_code = 'lead_status';

UPDATE vista SET
  vista_code = 'catalogs',
  display_name = 'Catalogs',
  route_path = '/catalog',
  sort_order = 70
WHERE id_sistema = @id_intake AND vista_code = 'catalogos';

UPDATE vista SET
  vista_code = 'user_management',
  display_name = 'User Management',
  route_path = 'user-management',
  sort_order = 80
WHERE id_sistema = @id_intake AND vista_code = 'usuarios';

UPDATE vista SET
  vista_code = 'grants',
  display_name = 'Grants',
  route_path = '/grants',
  sort_order = 90
WHERE id_sistema = @id_intake AND vista_code = 'grants_org';

UPDATE vista SET
  vista_code = 'marketing',
  display_name = 'Marketing (Home charts)',
  route_path = 'home-menu/case-manager',
  sort_order = 100
WHERE id_sistema = @id_intake AND vista_code = 'reportes';

UPDATE vista SET
  display_name = 'Login',
  route_path = '/signin',
  sort_order = 1
WHERE id_sistema = @id_intake AND vista_code = 'app';

-- Nueva vista: New Lead + Transfer (pantallas con ruta propia)
INSERT IGNORE INTO vista (id_tenant, id_sistema, vista_code, display_name, route_path, sort_order) VALUES
(@tenant, @id_intake, 'new_lead', 'New Lead', 'operations/new-lead', 15),
(@tenant, @id_intake, 'transfer', 'Transfer', 'operations/case-manager/:idLead/transfer', 25);

-- intake_leader / intake_director: marketing reemplaza reportes; sin entity_log
-- (grants en id_vista se conservan al renombrar vista_code arriba)

-- new_lead: submitter+ leader+ director
INSERT IGNORE INTO rol_vista_accion (id_rol, id_vista, id_accion)
SELECT r.id_rol, v.id_vista, a.id_accion
FROM rol r
JOIN vista v ON v.id_sistema = @id_intake AND v.vista_code = 'new_lead'
JOIN accion a ON a.action_code IN ('VER', 'CREAR')
WHERE r.role_code IN ('intake_submitter', 'intake_leader', 'intake_director');

-- transfer: leader+ director (+ specialist no)
INSERT IGNORE INTO rol_vista_accion (id_rol, id_vista, id_accion)
SELECT r.id_rol, v.id_vista, a.id_accion
FROM rol r
JOIN vista v ON v.id_sistema = @id_intake AND v.vista_code = 'transfer'
JOIN accion a ON a.action_code IN ('VER', 'ASIGNAR')
WHERE r.role_code IN ('intake_leader', 'intake_director');
