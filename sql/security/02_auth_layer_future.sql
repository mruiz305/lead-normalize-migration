-- =============================================================================
-- SECURITY_TNFG — capa de autenticación (OBJETIVO / no usada en sync bootstrap)
-- Aplicar con: npm run security:bootstrap:auth
-- No modifica identity_service_dev. Prepara SECURITY como IdP central futuro.
-- =============================================================================

SET NAMES utf8mb4;

-- Config OAuth por sistema (redirect URIs, secret rotatable)
CREATE TABLE IF NOT EXISTS sistema_oauth_config (
  id_sistema smallint unsigned NOT NULL,
  client_secret_hash varchar(255) DEFAULT NULL COMMENT 'bcrypt/argon2; NULL = public client PKCE',
  redirect_uris json DEFAULT NULL COMMENT '["https://intake.../callback"]',
  allowed_grant_types json DEFAULT NULL COMMENT '["authorization_code","refresh_token"]',
  token_ttl_seconds int unsigned NOT NULL DEFAULT 3600,
  refresh_ttl_seconds int unsigned NOT NULL DEFAULT 2592000,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_sistema),
  CONSTRAINT fk_oauth_cfg_sistema FOREIGN KEY (id_sistema) REFERENCES sistema (id_sistema)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='OAuth/OIDC por aplicación — runtime Identity API';

-- Credenciales de login (una persona puede tener password + SSO)
CREATE TABLE IF NOT EXISTS persona_credencial (
  id_credencial int unsigned NOT NULL AUTO_INCREMENT,
  id_persona int unsigned NOT NULL,
  credential_kind enum('PASSWORD','SSO_MICROSOFT','SSO_GOOGLE','API_KEY') NOT NULL,
  secret_hash varchar(255) DEFAULT NULL COMMENT 'hash password o ref externa SSO',
  must_change_password tinyint(1) NOT NULL DEFAULT 0,
  failed_attempts tinyint unsigned NOT NULL DEFAULT 0,
  locked_until datetime DEFAULT NULL,
  last_login_at datetime DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_credencial),
  UNIQUE KEY uk_persona_cred_kind (id_persona, credential_kind),
  CONSTRAINT fk_cred_persona FOREIGN KEY (id_persona) REFERENCES persona (id_persona)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Login central — nunca en app_user ni identity prod';

-- Invitación / alta / reset password
CREATE TABLE IF NOT EXISTS persona_invitacion (
  id_invitacion int unsigned NOT NULL AUTO_INCREMENT,
  id_persona int unsigned NOT NULL,
  invite_kind enum('ALTA','RESET_PASSWORD','REACTIVAR') NOT NULL,
  token_hash char(64) NOT NULL COMMENT 'SHA-256 del token enviado por email',
  expires_at datetime NOT NULL,
  consumed_at datetime DEFAULT NULL,
  created_by_persona int unsigned DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_invitacion),
  UNIQUE KEY uk_invite_token (token_hash),
  KEY idx_invite_persona (id_persona),
  KEY idx_invite_pending (expires_at, consumed_at),
  CONSTRAINT fk_invite_persona FOREIGN KEY (id_persona) REFERENCES persona (id_persona)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Flujos de registro y recuperación';

-- Sesiones / refresh tokens (Identity API runtime)
CREATE TABLE IF NOT EXISTS auth_sesion (
  id_sesion bigint unsigned NOT NULL AUTO_INCREMENT,
  id_persona int unsigned NOT NULL,
  id_sistema smallint unsigned NOT NULL COMMENT 'app que inició sesión',
  refresh_token_hash char(64) NOT NULL,
  user_agent varchar(512) DEFAULT NULL,
  ip_address varchar(45) DEFAULT NULL,
  expires_at datetime NOT NULL,
  revoked_at datetime DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_sesion),
  UNIQUE KEY uk_refresh_hash (refresh_token_hash),
  KEY idx_sesion_persona (id_persona),
  KEY idx_sesion_expires (expires_at),
  CONSTRAINT fk_sesion_persona FOREIGN KEY (id_persona) REFERENCES persona (id_persona),
  CONSTRAINT fk_sesion_sistema FOREIGN KEY (id_sistema) REFERENCES sistema (id_sistema)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Sesiones activas — reemplaza store en identity_service_dev';

-- Auditoría de provision a apps hijas
CREATE TABLE IF NOT EXISTS persona_provision_log (
  id_log bigint unsigned NOT NULL AUTO_INCREMENT,
  id_persona int unsigned NOT NULL,
  target_system enum('INTAKE_APP_USER','PORTAL_CACHE','INTEGRACION') NOT NULL,
  external_id varchar(64) DEFAULT NULL,
  status enum('OK','ERROR','PENDING') NOT NULL,
  detail json DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_log),
  KEY idx_provision_persona (id_persona),
  KEY idx_provision_status (status, created_at),
  CONSTRAINT fk_provision_persona FOREIGN KEY (id_persona) REFERENCES persona (id_persona)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Trazabilidad alta → app_user / portal';

-- Seed OAuth config mínima para INTAKE (client_secret se setea al desplegar Identity API)
INSERT IGNORE INTO sistema_oauth_config (id_sistema, redirect_uris, allowed_grant_types)
SELECT s.id_sistema,
       JSON_ARRAY('https://intake.tnfg.local/oauth/callback'),
       JSON_ARRAY('authorization_code', 'refresh_token')
FROM sistema s
WHERE s.system_code = 'INTAKE'
LIMIT 1;
