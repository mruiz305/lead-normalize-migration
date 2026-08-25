-- REPRESENTATIVES — nuevas vistas Home / Directory / perfil
-- Copia de tnfg-security-api/sql/14_seed_representatives_home_views.sql
-- Idempotente. English schema.

SET NAMES utf8mb4;

SET @tenant := 1;
SET @id_rep := (
  SELECT id FROM applications
  WHERE tenant_id = @tenant AND system_code IN ('REPRESENTATIVES', 'INTAKE')
  ORDER BY FIELD(system_code, 'REPRESENTATIVES', 'INTAKE')
  LIMIT 1
);

INSERT IGNORE INTO ui_views (tenant_id, application_id, view_code, display_name, route_path, sort_order) VALUES
(@tenant, @id_rep, 'directory_1800',            '1800 Directory',              '1800-directory',                    105),
(@tenant, @id_rep, 'schedule_call_back',        'Schedule Call Back',          NULL,                                120),
(@tenant, @id_rep, 'my_profile',                'My Profile',                  '/profile',                          130),
(@tenant, @id_rep, 'request',                   'Request',                     NULL,                                140),
(@tenant, @id_rep, 'lead_sheets',               'Lead Sheets',                 NULL,                                150),
(@tenant, @id_rep, 'lead_sheets_v2',            'Lead Sheets v2',              NULL,                                160),
(@tenant, @id_rep, 'general_lead_sheets',       'General Lead Sheets',         NULL,                                170),
(@tenant, @id_rep, 'logs_v2',                   'Logs V2',                     NULL,                                180),
(@tenant, @id_rep, 'regional_rosters',          'Regional Rosters',            NULL,                                190),
(@tenant, @id_rep, 'performance_roster_daily',  'Performance Roster Daily',    NULL,                                200),
(@tenant, @id_rep, 'edit_profile',              'Edit profile',                '/profile',                          210),
(@tenant, @id_rep, 'account_settings',          'Account settings',            '/profile',                          220);

INSERT IGNORE INTO role_view_actions (role_id, view_id, action_id)
SELECT r.id, v.id, a.id
FROM roles r
JOIN ui_views v ON v.application_id = @id_rep
JOIN actions a ON a.action_code = 'ADMIN'
WHERE r.application_id = @id_rep
  AND r.role_code IN ('representatives_system_admin', 'intake_system_admin')
  AND v.view_code IN (
    'directory_1800',
    'schedule_call_back',
    'my_profile',
    'request',
    'lead_sheets',
    'lead_sheets_v2',
    'general_lead_sheets',
    'logs_v2',
    'regional_rosters',
    'performance_roster_daily',
    'edit_profile',
    'account_settings'
  );
