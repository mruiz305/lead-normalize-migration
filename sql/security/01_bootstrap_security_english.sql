-- =============================================================================
-- SECURITY_TNFG — bootstrap (English schema, identity-aligned)
-- Greenfield installs: use this instead of deprecated 01_bootstrap_security.sql
-- See tnfg-security-api/docs/SCHEMA_ENGLISH_RENAME.md
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS user_resource_access;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS user_external_links;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS applications;
DROP TABLE IF EXISTS tenants;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE tenants (
  id tinyint unsigned NOT NULL AUTO_INCREMENT,
  slug varchar(50) NOT NULL COMMENT 'unique slug e.g. tnfg',
  name varchar(150) NOT NULL,
  portal_tenant_id bigint unsigned DEFAULT NULL COMMENT 'identity.tenants.id — sync reference',
  is_active tinyint(1) NOT NULL DEFAULT 1,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_tenant_slug (slug),
  KEY idx_tenant_portal (portal_tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE applications (
  id smallint unsigned NOT NULL AUTO_INCREMENT,
  tenant_id tinyint unsigned NOT NULL,
  system_code varchar(80) NOT NULL COMMENT 'PORTAL_ABOGADOS, REPRESENTATIVES…',
  name varchar(150) NOT NULL,
  portal_application_id bigint unsigned DEFAULT NULL COMMENT 'identity.applications.id',
  oauth_client_id char(36) DEFAULT NULL COMMENT 'identity.applications.client_id',
  is_active tinyint(1) NOT NULL DEFAULT 1,
  synced_at datetime DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_application_tenant_code (tenant_id, system_code),
  KEY idx_application_portal_app (portal_application_id),
  CONSTRAINT fk_application_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE users (
  id int unsigned NOT NULL AUTO_INCREMENT,
  tenant_id tinyint unsigned NOT NULL,
  email varchar(254) NOT NULL,
  display_name varchar(200) DEFAULT NULL,
  person_kind enum('STAFF_INTERNO','SOCIO_EXTERNO','SERVICIO') NOT NULL DEFAULT 'STAFF_INTERNO',
  is_active tinyint(1) NOT NULL DEFAULT 1,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_tenant_email (tenant_id, email),
  KEY idx_user_kind (person_kind),
  CONSTRAINT fk_user_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_external_links (
  id int unsigned NOT NULL AUTO_INCREMENT,
  user_id int unsigned NOT NULL,
  source_system enum('PORTAL_IDENTITY','INTAKE_APP_USER') NOT NULL,
  external_id varchar(64) NOT NULL,
  synced_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_source (user_id, source_system, external_id),
  KEY idx_link_lookup (source_system, external_id),
  CONSTRAINT fk_link_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE roles (
  id smallint unsigned NOT NULL AUTO_INCREMENT,
  tenant_id tinyint unsigned NOT NULL,
  application_id smallint unsigned DEFAULT NULL,
  role_code varchar(100) NOT NULL,
  display_name varchar(150) DEFAULT NULL,
  portal_role_id bigint unsigned DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  synced_at datetime DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_role_tenant_code (tenant_id, role_code),
  KEY idx_role_application (application_id),
  CONSTRAINT fk_role_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id),
  CONSTRAINT fk_role_application FOREIGN KEY (application_id) REFERENCES applications (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE permissions (
  id smallint unsigned NOT NULL AUTO_INCREMENT,
  tenant_id tinyint unsigned NOT NULL,
  application_id smallint unsigned DEFAULT NULL,
  permission_code varchar(150) NOT NULL,
  display_name varchar(200) DEFAULT NULL,
  portal_permission_id bigint unsigned DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  synced_at datetime DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_permission_tenant_code (tenant_id, permission_code),
  KEY idx_permission_application (application_id),
  CONSTRAINT fk_permission_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id),
  CONSTRAINT fk_permission_application FOREIGN KEY (application_id) REFERENCES applications (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE role_permissions (
  role_id smallint unsigned NOT NULL,
  permission_id smallint unsigned NOT NULL,
  portal_role_permission_id bigint unsigned DEFAULT NULL,
  synced_at datetime DEFAULT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles (id),
  CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES permissions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_roles (
  id int unsigned NOT NULL AUTO_INCREMENT,
  user_id int unsigned NOT NULL,
  role_id smallint unsigned NOT NULL,
  portal_user_role_id bigint unsigned DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  synced_at datetime DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_role (user_id, role_id),
  KEY idx_ur_role (role_id),
  CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_resource_access (
  id int unsigned NOT NULL AUTO_INCREMENT,
  user_id int unsigned NOT NULL,
  application_id smallint unsigned NOT NULL,
  resource_type enum('ABOGADO','CLINICA_TX','OFICINA','EQUIPO','LEAD') NOT NULL,
  resource_external_id bigint unsigned NOT NULL,
  access_level enum('VER','EDITAR','ADMIN') NOT NULL DEFAULT 'VER',
  can_export tinyint(1) NOT NULL DEFAULT 0,
  valid_from datetime DEFAULT NULL,
  valid_to datetime DEFAULT NULL,
  portal_resource_access_id bigint unsigned DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  synced_at datetime DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ura_user (user_id),
  KEY idx_ura_application (application_id),
  KEY idx_ura_resource (resource_type, resource_external_id),
  CONSTRAINT fk_ura_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_ura_application FOREIGN KEY (application_id) REFERENCES applications (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO tenants (id, slug, name, portal_tenant_id, is_active)
VALUES (1, 'tnfg', 'TNFG', 1, 1);

INSERT INTO applications (tenant_id, system_code, name, portal_application_id, oauth_client_id, is_active) VALUES
(1, 'PORTAL_ABOGADOS', 'TNFG Case Management Portal', 1, '4b502c28-2214-4169-a21e-6121112d2967', 1),
(1, 'INTEGRACION_YIA', 'Integration Service - YIA Client', 2, '3f826595-6477-42a3-8279-588421402d61', 1),
(1, 'INTEGRACION_PRICEBENOWITZ', 'Integration Service - PRICEBENOWITZ Client', 4, 'c867da5f-51ec-438a-a7a4-db4a5230fb68', 1),
(1, 'INTEGRACION_HAMMER', 'Integration Service - Hammer Client', 5, '6de6bdee-48aa-4aca-9b43-a756cb15afcb', 0),
(1, 'INTAKE', 'Intake normalizado TNFG', NULL, NULL, 1);
