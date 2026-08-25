-- Seed vistas INTAKE + matriz rol_vista_accion
-- Catálogo alineado con pantallas intake migradas (Case Manager, User Management, …).
-- Sin auditoría / entity_log (no hay UI). Idempotente.

SET NAMES utf8mb4;

SET @tenant := 1;
SET @id_intake := (SELECT id_sistema FROM sistema WHERE id_tenant = @tenant AND system_code = 'INTAKE' LIMIT 1);

INSERT IGNORE INTO vista (id_tenant, id_sistema, vista_code, display_name, route_path, sort_order) VALUES
(@tenant, @id_intake, 'app',               'Login',                    '/signin',                                      1),
(@tenant, @id_intake, 'case_manager',      'Case Manager',             'operations/case-manager',                     10),
(@tenant, @id_intake, 'new_lead',          'New Lead',                 'operations/new-lead',                         15),
(@tenant, @id_intake, 'lead_detail',       'Lead Detail',              'operations/case-manager/:idLead',             20),
(@tenant, @id_intake, 'transfer',          'Transfer',                 'operations/case-manager/:idLead/transfer',    25),
(@tenant, @id_intake, 'edit_demographics', 'Edit Lead — Demographics', NULL,                                          30),
(@tenant, @id_intake, 'edit_passengers',   'Edit Lead — Passengers',   NULL,                                          40),
(@tenant, @id_intake, 'comments',          'Comments & notes',         NULL,                                          50),
(@tenant, @id_intake, 'lead_status',       'Lead status change',       NULL,                                          60),
(@tenant, @id_intake, 'catalogs',          'Catalogs',                 '/catalog',                                    70),
(@tenant, @id_intake, 'user_management',   'User Management',          'user-management',                             80),
(@tenant, @id_intake, 'grants',            'Grants',                   '/grants',                                     90),
(@tenant, @id_intake, 'marketing',         'Marketing (Home charts)',  'home-menu/case-manager',                     100),
(@tenant, @id_intake, 'directory_1800',            '1800 Directory',              '1800-directory',                    105),
(@tenant, @id_intake, 'schedule_call_back',        'Schedule Call Back',          NULL,                                120),
(@tenant, @id_intake, 'my_profile',                'My Profile',                  '/profile',                          130),
(@tenant, @id_intake, 'request',                   'Request',                     NULL,                                140),
(@tenant, @id_intake, 'lead_sheets',               'Lead Sheets',                 NULL,                                150),
(@tenant, @id_intake, 'lead_sheets_v2',            'Lead Sheets v2',              NULL,                                160),
(@tenant, @id_intake, 'general_lead_sheets',       'General Lead Sheets',         NULL,                                170),
(@tenant, @id_intake, 'logs_v2',                   'Logs V2',                     NULL,                                180),
(@tenant, @id_intake, 'regional_rosters',          'Regional Rosters',            NULL,                                190),
(@tenant, @id_intake, 'performance_roster_daily',  'Performance Roster Daily',    NULL,                                200),
(@tenant, @id_intake, 'edit_profile',              'Edit profile',                '/profile',                          210),
(@tenant, @id_intake, 'account_settings',          'Account settings',            '/profile',                          220);

-- intake_readonly
INSERT IGNORE INTO rol_vista_accion (id_rol, id_vista, id_accion)
SELECT r.id_rol, v.id_vista, a.id_accion
FROM rol r
CROSS JOIN vista v
CROSS JOIN accion a
WHERE r.role_code = 'intake_readonly'
  AND v.id_sistema = @id_intake
  AND (
    (v.vista_code = 'app' AND a.action_code = 'LOGIN')
    OR (v.vista_code IN ('case_manager','lead_detail','edit_demographics','edit_passengers','comments','catalogs') AND a.action_code = 'VER')
  );

-- intake_submitter
INSERT IGNORE INTO rol_vista_accion (id_rol, id_vista, id_accion)
SELECT r.id_rol, v.id_vista, a.id_accion
FROM rol r
CROSS JOIN vista v
CROSS JOIN accion a
WHERE r.role_code = 'intake_submitter'
  AND v.id_sistema = @id_intake
  AND (
    (v.vista_code = 'app' AND a.action_code = 'LOGIN')
    OR (v.vista_code = 'case_manager' AND a.action_code IN ('VER','CREAR'))
    OR (v.vista_code = 'new_lead' AND a.action_code IN ('VER','CREAR'))
    OR (v.vista_code = 'lead_detail' AND a.action_code IN ('VER','EDITAR'))
    OR (v.vista_code IN ('edit_demographics','edit_passengers') AND a.action_code IN ('VER','EDITAR'))
    OR (v.vista_code = 'comments' AND a.action_code IN ('VER','CREAR'))
    OR (v.vista_code = 'catalogs' AND a.action_code = 'VER')
  );

-- intake_specialist
INSERT IGNORE INTO rol_vista_accion (id_rol, id_vista, id_accion)
SELECT r.id_rol, v.id_vista, a.id_accion
FROM rol r
CROSS JOIN vista v
CROSS JOIN accion a
WHERE r.role_code = 'intake_specialist'
  AND v.id_sistema = @id_intake
  AND (
    (v.vista_code = 'app' AND a.action_code = 'LOGIN')
    OR (v.vista_code = 'case_manager' AND a.action_code IN ('VER','EXPORTAR'))
    OR (v.vista_code = 'lead_detail' AND a.action_code IN ('VER','EDITAR'))
    OR (v.vista_code IN ('edit_demographics','edit_passengers') AND a.action_code IN ('VER','EDITAR'))
    OR (v.vista_code = 'comments' AND a.action_code IN ('VER','CREAR','EDITAR'))
    OR (v.vista_code = 'lead_status' AND a.action_code IN ('VER','EDITAR'))
    OR (v.vista_code = 'catalogs' AND a.action_code = 'VER')
  );

-- intake_leader
INSERT IGNORE INTO rol_vista_accion (id_rol, id_vista, id_accion)
SELECT r.id_rol, v.id_vista, a.id_accion
FROM rol r
CROSS JOIN vista v
CROSS JOIN accion a
WHERE r.role_code = 'intake_leader'
  AND v.id_sistema = @id_intake
  AND (
    (v.vista_code = 'app' AND a.action_code = 'LOGIN')
    OR (v.vista_code = 'case_manager' AND a.action_code IN ('VER','CREAR','EXPORTAR','ASIGNAR'))
    OR (v.vista_code = 'new_lead' AND a.action_code IN ('VER','CREAR'))
    OR (v.vista_code = 'transfer' AND a.action_code IN ('VER','ASIGNAR'))
    OR (v.vista_code = 'lead_detail' AND a.action_code IN ('VER','EDITAR','ASIGNAR'))
    OR (v.vista_code IN ('edit_demographics','edit_passengers') AND a.action_code IN ('VER','EDITAR'))
    OR (v.vista_code = 'comments' AND a.action_code IN ('VER','CREAR','EDITAR'))
    OR (v.vista_code = 'lead_status' AND a.action_code IN ('VER','EDITAR'))
    OR (v.vista_code = 'catalogs' AND a.action_code = 'VER')
    OR (v.vista_code = 'user_management' AND a.action_code = 'VER')
    OR (v.vista_code = 'marketing' AND a.action_code IN ('VER','EXPORTAR'))
  );

-- intake_director
INSERT IGNORE INTO rol_vista_accion (id_rol, id_vista, id_accion)
SELECT r.id_rol, v.id_vista, a.id_accion
FROM rol r
CROSS JOIN vista v
CROSS JOIN accion a
WHERE r.role_code = 'intake_director'
  AND v.id_sistema = @id_intake
  AND (
    (v.vista_code = 'app' AND a.action_code = 'LOGIN')
    OR (v.vista_code = 'case_manager' AND a.action_code IN ('VER','CREAR','EDITAR','EXPORTAR','ASIGNAR','ANULAR'))
    OR (v.vista_code = 'new_lead' AND a.action_code IN ('VER','CREAR'))
    OR (v.vista_code = 'transfer' AND a.action_code IN ('VER','ASIGNAR'))
    OR (v.vista_code = 'lead_detail' AND a.action_code IN ('VER','EDITAR','ASIGNAR'))
    OR (v.vista_code IN ('edit_demographics','edit_passengers') AND a.action_code IN ('VER','EDITAR'))
    OR (v.vista_code = 'comments' AND a.action_code IN ('VER','CREAR','EDITAR'))
    OR (v.vista_code = 'lead_status' AND a.action_code IN ('VER','EDITAR'))
    OR (v.vista_code = 'catalogs' AND a.action_code IN ('VER','EDITAR'))
    OR (v.vista_code IN ('user_management','grants') AND a.action_code IN ('VER','EDITAR'))
    OR (v.vista_code = 'marketing' AND a.action_code IN ('VER','EXPORTAR'))
  );

-- intake_system_admin → ADMIN en todas las vistas intake
INSERT IGNORE INTO rol_vista_accion (id_rol, id_vista, id_accion)
SELECT r.id_rol, v.id_vista, a.id_accion
FROM rol r
CROSS JOIN vista v
CROSS JOIN accion a
WHERE r.role_code = 'intake_system_admin'
  AND v.id_sistema = @id_intake
  AND a.action_code = 'ADMIN';
