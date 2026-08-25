-- SECURITY_TNFG — English action labels + FILTRAR (Filter)
-- Safe to re-run (UPDATE + INSERT IGNORE).
-- local/dev/staging only — do not run in production without team approval.

SET NAMES utf8mb4;

UPDATE accion SET display_name = 'Sign in', sort_order = 1 WHERE action_code = 'LOGIN';
UPDATE accion SET display_name = 'View', sort_order = 10 WHERE action_code = 'VER';
UPDATE accion SET display_name = 'Create', sort_order = 20 WHERE action_code = 'CREAR';
UPDATE accion SET display_name = 'Edit', sort_order = 30 WHERE action_code = 'EDITAR';
UPDATE accion SET display_name = 'Delete', sort_order = 40 WHERE action_code = 'ELIMINAR';
UPDATE accion SET display_name = 'Void', sort_order = 50 WHERE action_code = 'ANULAR';
UPDATE accion SET display_name = 'Assign', sort_order = 60 WHERE action_code = 'ASIGNAR';
UPDATE accion SET display_name = 'Export', sort_order = 70 WHERE action_code = 'EXPORTAR';
UPDATE accion SET display_name = 'Execute', sort_order = 80 WHERE action_code = 'EJECUTAR';
UPDATE accion SET display_name = 'Admin', sort_order = 90 WHERE action_code = 'ADMIN';

INSERT IGNORE INTO accion (action_code, display_name, sort_order) VALUES
('FILTRAR', 'Filter', 15);

UPDATE accion SET display_name = 'Filter', sort_order = 15 WHERE action_code = 'FILTRAR';
