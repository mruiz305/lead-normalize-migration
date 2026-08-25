-- =============================================================================
-- SECURITY_TNFG — OTP login (portal abogados)
-- Aplicar con: mysql SECURITY_TNFG < sql/security/03_auth_otp.sql
-- =============================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS auth_otp_challenge (
  id_challenge bigint unsigned NOT NULL AUTO_INCREMENT,
  id_sistema smallint unsigned NOT NULL,
  email varchar(254) NOT NULL,
  code_hash char(64) NOT NULL COMMENT 'SHA-256 del código OTP',
  attempts tinyint unsigned NOT NULL DEFAULT 0,
  expires_at datetime NOT NULL,
  consumed_at datetime DEFAULT NULL,
  user_agent varchar(512) DEFAULT NULL,
  ip_address varchar(45) DEFAULT NULL,
  idempotency_key varchar(64) DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_challenge),
  KEY idx_otp_lookup (id_sistema, email, consumed_at, expires_at),
  CONSTRAINT fk_otp_sistema FOREIGN KEY (id_sistema) REFERENCES sistema (id_sistema)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Desafíos OTP — login portal por email';

-- OAuth config mínima para PORTAL_ABOGADOS (OTP + refresh)
INSERT IGNORE INTO sistema_oauth_config (id_sistema, redirect_uris, allowed_grant_types, token_ttl_seconds, refresh_ttl_seconds)
SELECT s.id_sistema,
       JSON_ARRAY('http://localhost:5173'),
       JSON_ARRAY('otp', 'refresh_token'),
       300,
       3888000
FROM sistema s
WHERE s.system_code = 'PORTAL_ABOGADOS'
LIMIT 1;
