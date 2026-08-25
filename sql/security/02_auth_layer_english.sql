-- SECURITY_TNFG — auth layer (English schema)
-- Apply after 01_bootstrap_security_english.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS application_oauth_configs (
  application_id smallint unsigned NOT NULL,
  client_secret_hash varchar(255) DEFAULT NULL,
  redirect_uris json DEFAULT NULL,
  allowed_grant_types json DEFAULT NULL,
  token_ttl_seconds int unsigned NOT NULL DEFAULT 3600,
  refresh_ttl_seconds int unsigned NOT NULL DEFAULT 2592000,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (application_id),
  CONSTRAINT fk_oauth_cfg_application FOREIGN KEY (application_id) REFERENCES applications (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_credentials (
  id int unsigned NOT NULL AUTO_INCREMENT,
  user_id int unsigned NOT NULL,
  credential_kind enum('PASSWORD','SSO_MICROSOFT','SSO_GOOGLE','API_KEY') NOT NULL,
  secret_hash varchar(255) DEFAULT NULL,
  must_change_password tinyint(1) NOT NULL DEFAULT 0,
  failed_attempts tinyint unsigned NOT NULL DEFAULT 0,
  locked_until datetime DEFAULT NULL,
  last_login_at datetime DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_cred_kind (user_id, credential_kind),
  CONSTRAINT fk_cred_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_invitations (
  id int unsigned NOT NULL AUTO_INCREMENT,
  user_id int unsigned NOT NULL,
  invite_kind enum('ALTA','RESET_PASSWORD','REACTIVAR') NOT NULL,
  token_hash char(64) NOT NULL,
  expires_at datetime NOT NULL,
  consumed_at datetime DEFAULT NULL,
  created_by int unsigned DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_invite_token (token_hash),
  KEY idx_invite_user (user_id),
  CONSTRAINT fk_invite_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sessions (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  user_id int unsigned NOT NULL,
  application_id smallint unsigned NOT NULL,
  refresh_token_hash char(64) NOT NULL,
  user_agent varchar(512) DEFAULT NULL,
  ip varchar(45) DEFAULT NULL,
  expires_at datetime NOT NULL,
  revoked_at datetime DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_refresh_hash (refresh_token_hash),
  KEY idx_session_user (user_id),
  KEY idx_session_expires (expires_at),
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_session_application FOREIGN KEY (application_id) REFERENCES applications (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_provision_logs (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  user_id int unsigned NOT NULL,
  target_system enum('INTAKE_APP_USER','PORTAL_CACHE','INTEGRACION') NOT NULL,
  external_id varchar(64) DEFAULT NULL,
  status enum('OK','ERROR','PENDING') NOT NULL,
  detail json DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_provision_user (user_id),
  CONSTRAINT fk_provision_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO application_oauth_configs (application_id, redirect_uris, allowed_grant_types)
SELECT a.id,
       JSON_ARRAY('https://intake.tnfg.local/oauth/callback'),
       JSON_ARRAY('authorization_code', 'refresh_token')
FROM applications a
WHERE a.system_code = 'INTAKE'
LIMIT 1;
