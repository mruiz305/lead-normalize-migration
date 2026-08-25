-- =============================================================================
-- SECURITY_TNFG — catálogo Vista × Acción (additive, no rompe permiso legacy)
-- Ver docs/SECURITY_RBAC_CATALOGO.md
-- =============================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS accion (
  id_accion tinyint unsigned NOT NULL AUTO_INCREMENT,
  action_code varchar(20) NOT NULL COMMENT 'VER, CREAR, EDITAR, EXPORTAR…',
  display_name varchar(80) NOT NULL,
  sort_order tinyint unsigned NOT NULL DEFAULT 0,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_accion),
  UNIQUE KEY uk_accion_code (action_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Catálogo global de verbos RBAC';

CREATE TABLE IF NOT EXISTS vista (
  id_vista smallint unsigned NOT NULL AUTO_INCREMENT,
  id_tenant tinyint unsigned NOT NULL,
  id_sistema smallint unsigned NOT NULL,
  vista_code varchar(80) NOT NULL COMMENT 'leads, lead_notas, catalogos…',
  display_name varchar(150) NOT NULL,
  route_path varchar(200) DEFAULT NULL COMMENT 'Ruta front opcional',
  parent_vista_id smallint unsigned DEFAULT NULL,
  sort_order smallint unsigned NOT NULL DEFAULT 0,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_vista),
  UNIQUE KEY uk_vista_tenant_sistema_code (id_tenant, id_sistema, vista_code),
  KEY idx_vista_sistema (id_sistema),
  KEY idx_vista_parent (parent_vista_id),
  CONSTRAINT fk_vista_tenant FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant),
  CONSTRAINT fk_vista_sistema FOREIGN KEY (id_sistema) REFERENCES sistema (id_sistema),
  CONSTRAINT fk_vista_parent FOREIGN KEY (parent_vista_id) REFERENCES vista (id_vista)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Pantallas/módulos por sistema';

CREATE TABLE IF NOT EXISTS rol_vista_accion (
  id_rol smallint unsigned NOT NULL,
  id_vista smallint unsigned NOT NULL,
  id_accion tinyint unsigned NOT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_rol, id_vista, id_accion),
  KEY idx_rva_vista (id_vista),
  KEY idx_rva_accion (id_accion),
  CONSTRAINT fk_rva_rol FOREIGN KEY (id_rol) REFERENCES rol (id_rol),
  CONSTRAINT fk_rva_vista FOREIGN KEY (id_vista) REFERENCES vista (id_vista),
  CONSTRAINT fk_rva_accion FOREIGN KEY (id_accion) REFERENCES accion (id_accion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Matriz rol → vista → acción';

-- Puente opcional: permiso flat legacy puede apuntar a vista+accion
SET @permiso_has_vista := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'permiso' AND COLUMN_NAME = 'id_vista'
);

SET @sql_permiso := IF(@permiso_has_vista = 0,
  'ALTER TABLE permiso
     ADD COLUMN id_vista smallint unsigned DEFAULT NULL AFTER id_sistema,
     ADD COLUMN id_accion tinyint unsigned DEFAULT NULL AFTER id_vista,
     ADD KEY idx_permiso_vista_accion (id_vista, id_accion),
     ADD CONSTRAINT fk_permiso_vista FOREIGN KEY (id_vista) REFERENCES vista (id_vista),
     ADD CONSTRAINT fk_permiso_accion FOREIGN KEY (id_accion) REFERENCES accion (id_accion)',
  'SELECT ''permiso.id_vista ya existe'' AS note'
);
PREPARE stmt FROM @sql_permiso;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Seed acciones globales
INSERT IGNORE INTO accion (action_code, display_name, sort_order) VALUES
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
