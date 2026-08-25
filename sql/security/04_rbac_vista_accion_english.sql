-- SECURITY_TNFG — RBAC view × action catalog (English schema)

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS actions (
  id tinyint unsigned NOT NULL AUTO_INCREMENT,
  action_code varchar(20) NOT NULL,
  display_name varchar(80) NOT NULL,
  sort_order tinyint unsigned NOT NULL DEFAULT 0,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uk_action_code (action_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ui_views (
  id smallint unsigned NOT NULL AUTO_INCREMENT,
  tenant_id tinyint unsigned NOT NULL,
  application_id smallint unsigned NOT NULL,
  view_code varchar(80) NOT NULL,
  display_name varchar(150) NOT NULL,
  route_path varchar(200) DEFAULT NULL,
  parent_view_id smallint unsigned DEFAULT NULL,
  sort_order smallint unsigned NOT NULL DEFAULT 0,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_view_tenant_application_code (tenant_id, application_id, view_code),
  KEY idx_view_application (application_id),
  CONSTRAINT fk_view_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id),
  CONSTRAINT fk_view_application FOREIGN KEY (application_id) REFERENCES applications (id),
  CONSTRAINT fk_view_parent FOREIGN KEY (parent_view_id) REFERENCES ui_views (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS role_view_actions (
  role_id smallint unsigned NOT NULL,
  view_id smallint unsigned NOT NULL,
  action_id tinyint unsigned NOT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, view_id, action_id),
  CONSTRAINT fk_rva_role FOREIGN KEY (role_id) REFERENCES roles (id),
  CONSTRAINT fk_rva_view FOREIGN KEY (view_id) REFERENCES ui_views (id),
  CONSTRAINT fk_rva_action FOREIGN KEY (action_id) REFERENCES actions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @perm_has_view := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'permissions' AND COLUMN_NAME = 'view_id'
);

SET @sql_perm := IF(@perm_has_view = 0,
  'ALTER TABLE permissions
     ADD COLUMN view_id smallint unsigned DEFAULT NULL AFTER application_id,
     ADD COLUMN action_id tinyint unsigned DEFAULT NULL AFTER view_id,
     ADD KEY idx_permission_view_action (view_id, action_id),
     ADD CONSTRAINT fk_permission_view FOREIGN KEY (view_id) REFERENCES ui_views (id),
     ADD CONSTRAINT fk_permission_action FOREIGN KEY (action_id) REFERENCES actions (id)',
  'SELECT ''permissions.view_id already exists'' AS note'
);
PREPARE stmt FROM @sql_perm;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO actions (action_code, display_name, sort_order) VALUES
('LOGIN',    'Sign in', 1),
('VER',      'View', 10),
('FILTRAR',  'Filter', 15),
('CREAR',    'Create', 20),
('EDITAR',   'Edit', 30),
('ELIMINAR', 'Delete', 40),
('ANULAR',   'Void', 50),
('ASIGNAR',  'Assign', 60),
('EXPORTAR', 'Export', 70),
('EJECUTAR', 'Execute', 80),
('ADMIN',    'Admin', 90);
