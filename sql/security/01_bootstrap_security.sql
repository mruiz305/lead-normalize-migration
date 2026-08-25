-- =============================================================================
-- SECURITY_TNFG — bootstrap fase 0 (RBAC + persona)
-- Objetivo macro: SECURITY reemplaza identity_service_dev — ver docs/SECURITY_TNFG_VISION.md
-- Hoy: portal prod solo lectura en sync; auth en 02_auth_layer_future.sql
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS persona_acceso_recurso;
DROP TABLE IF EXISTS persona_rol;
DROP TABLE IF EXISTS rol_permiso;
DROP TABLE IF EXISTS permiso;
DROP TABLE IF EXISTS rol;
DROP TABLE IF EXISTS persona_sistema_origen;
DROP TABLE IF EXISTS persona;
DROP TABLE IF EXISTS sistema;
DROP TABLE IF EXISTS tenant;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE tenant (
  id_tenant tinyint unsigned NOT NULL AUTO_INCREMENT,
  tenant_code varchar(50) NOT NULL COMMENT 'slug único ej. tnfg',
  display_name varchar(150) NOT NULL,
  portal_tenant_id bigint unsigned DEFAULT NULL COMMENT 'identity.tenants.id — solo referencia sync',
  is_active tinyint(1) NOT NULL DEFAULT 1,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_tenant),
  UNIQUE KEY uk_tenant_code (tenant_code),
  KEY idx_tenant_portal (portal_tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Organización / inquilino (multi-tenant; hoy solo TNFG)';

CREATE TABLE sistema (
  id_sistema smallint unsigned NOT NULL AUTO_INCREMENT,
  id_tenant tinyint unsigned NOT NULL,
  system_code varchar(80) NOT NULL COMMENT 'PORTAL_ABOGADOS, INTEGRACION_YIA, INTAKE…',
  display_name varchar(150) NOT NULL,
  portal_application_id bigint unsigned DEFAULT NULL COMMENT 'identity.applications.id',
  oauth_client_id char(36) DEFAULT NULL COMMENT 'identity.applications.client_id',
  is_active tinyint(1) NOT NULL DEFAULT 1,
  synced_at datetime DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_sistema),
  UNIQUE KEY uk_sistema_tenant_code (id_tenant, system_code),
  KEY idx_sistema_portal_app (portal_application_id),
  CONSTRAINT fk_sistema_tenant FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Aplicaciones / productos TNFG bajo un tenant';

CREATE TABLE persona (
  id_persona int unsigned NOT NULL AUTO_INCREMENT,
  id_tenant tinyint unsigned NOT NULL,
  email varchar(254) NOT NULL,
  display_name varchar(200) DEFAULT NULL,
  person_kind enum('STAFF_INTERNO','SOCIO_EXTERNO','SERVICIO') NOT NULL DEFAULT 'STAFF_INTERNO',
  is_active tinyint(1) NOT NULL DEFAULT 1,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_persona),
  UNIQUE KEY uk_persona_tenant_email (id_tenant, email),
  KEY idx_persona_kind (person_kind),
  CONSTRAINT fk_persona_tenant FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Persona central — una por email dentro del tenant';

CREATE TABLE persona_sistema_origen (
  id_link int unsigned NOT NULL AUTO_INCREMENT,
  id_persona int unsigned NOT NULL,
  source_system enum('PORTAL_IDENTITY','INTAKE_APP_USER') NOT NULL,
  external_id varchar(64) NOT NULL COMMENT 'id en sistema origen',
  synced_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_link),
  UNIQUE KEY uk_persona_source (id_persona, source_system, external_id),
  KEY idx_origen_lookup (source_system, external_id),
  CONSTRAINT fk_origen_persona FOREIGN KEY (id_persona) REFERENCES persona (id_persona)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Enlace persona ↔ id legacy (solo referencia)';

CREATE TABLE rol (
  id_rol smallint unsigned NOT NULL AUTO_INCREMENT,
  id_tenant tinyint unsigned NOT NULL,
  id_sistema smallint unsigned DEFAULT NULL COMMENT 'NULL = rol global portal legacy',
  role_code varchar(100) NOT NULL,
  display_name varchar(150) DEFAULT NULL,
  portal_role_id bigint unsigned DEFAULT NULL COMMENT 'identity.roles.id',
  is_active tinyint(1) NOT NULL DEFAULT 1,
  synced_at datetime DEFAULT NULL,
  PRIMARY KEY (id_rol),
  UNIQUE KEY uk_rol_tenant_code (id_tenant, role_code),
  KEY idx_rol_sistema (id_sistema),
  KEY idx_rol_portal (portal_role_id),
  CONSTRAINT fk_rol_tenant FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant),
  CONSTRAINT fk_rol_sistema FOREIGN KEY (id_sistema) REFERENCES sistema (id_sistema)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE permiso (
  id_permiso smallint unsigned NOT NULL AUTO_INCREMENT,
  id_tenant tinyint unsigned NOT NULL,
  id_sistema smallint unsigned DEFAULT NULL,
  permission_code varchar(150) NOT NULL COMMENT 'cases:read, lead:edit…',
  display_name varchar(200) DEFAULT NULL,
  portal_permission_id bigint unsigned DEFAULT NULL COMMENT 'identity.permissions.id',
  is_active tinyint(1) NOT NULL DEFAULT 1,
  synced_at datetime DEFAULT NULL,
  PRIMARY KEY (id_permiso),
  UNIQUE KEY uk_permiso_tenant_code (id_tenant, permission_code),
  KEY idx_permiso_sistema (id_sistema),
  CONSTRAINT fk_permiso_tenant FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant),
  CONSTRAINT fk_permiso_sistema FOREIGN KEY (id_sistema) REFERENCES sistema (id_sistema)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE rol_permiso (
  id_rol smallint unsigned NOT NULL,
  id_permiso smallint unsigned NOT NULL,
  portal_role_permission_id bigint unsigned DEFAULT NULL,
  synced_at datetime DEFAULT NULL,
  PRIMARY KEY (id_rol, id_permiso),
  CONSTRAINT fk_rp_rol FOREIGN KEY (id_rol) REFERENCES rol (id_rol),
  CONSTRAINT fk_rp_permiso FOREIGN KEY (id_permiso) REFERENCES permiso (id_permiso)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE persona_rol (
  id_persona_rol int unsigned NOT NULL AUTO_INCREMENT,
  id_persona int unsigned NOT NULL,
  id_rol smallint unsigned NOT NULL,
  portal_user_role_id bigint unsigned DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  synced_at datetime DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_persona_rol),
  UNIQUE KEY uk_persona_rol (id_persona, id_rol),
  KEY idx_pr_rol (id_rol),
  CONSTRAINT fk_pr_persona FOREIGN KEY (id_persona) REFERENCES persona (id_persona),
  CONSTRAINT fk_pr_rol FOREIGN KEY (id_rol) REFERENCES rol (id_rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE persona_acceso_recurso (
  id_acceso int unsigned NOT NULL AUTO_INCREMENT,
  id_persona int unsigned NOT NULL,
  id_sistema smallint unsigned NOT NULL,
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
  PRIMARY KEY (id_acceso),
  KEY idx_par_persona (id_persona),
  KEY idx_par_sistema (id_sistema),
  KEY idx_par_resource (resource_type, resource_external_id),
  CONSTRAINT fk_par_persona FOREIGN KEY (id_persona) REFERENCES persona (id_persona),
  CONSTRAINT fk_par_sistema FOREIGN KEY (id_sistema) REFERENCES sistema (id_sistema)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Acceso a recurso concreto (portal: abogado/clínica; intake: oficina/equipo)';

-- Seed tenant TNFG (portal identity.tenants id=1)
INSERT INTO tenant (id_tenant, tenant_code, display_name, portal_tenant_id, is_active)
VALUES (1, 'tnfg', 'TNFG', 1, 1);

-- Sistemas: portal + integraciones (portal_application_id se confirma en sync)
INSERT INTO sistema (id_tenant, system_code, display_name, portal_application_id, oauth_client_id, is_active) VALUES
(1, 'PORTAL_ABOGADOS', 'TNFG Case Management Portal', 1, '4b502c28-2214-4169-a21e-6121112d2967', 1),
(1, 'INTEGRACION_YIA', 'Integration Service - YIA Client', 2, '3f826595-6477-42a3-8279-588421402d61', 1),
(1, 'INTEGRACION_PRICEBENOWITZ', 'Integration Service - PRICEBENOWITZ Client', 4, 'c867da5f-51ec-438a-a7a4-db4a5230fb68', 1),
(1, 'INTEGRACION_HAMMER', 'Integration Service - Hammer Client', 5, '6de6bdee-48aa-4aca-9b43-a756cb15afcb', 0),
(1, 'INTAKE', 'Intake normalizado TNFG', NULL, NULL, 1);
