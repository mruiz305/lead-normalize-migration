-- Dominios de email permitidos por aplicación (OTP / altas)
-- Copia alineada con tnfg-security/api/sql/07_sistema_email_domain.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS sistema_email_domain (
  id_domain bigint unsigned NOT NULL AUTO_INCREMENT,
  id_sistema smallint unsigned NOT NULL,
  domain varchar(255) NOT NULL COMMENT 'sin @, lowercase ej. 305nofault.com',
  is_active tinyint(1) NOT NULL DEFAULT 1,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by_persona int unsigned DEFAULT NULL,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by_persona int unsigned DEFAULT NULL,
  PRIMARY KEY (id_domain),
  UNIQUE KEY uk_sistema_domain (id_sistema, domain),
  KEY idx_sed_sistema_active (id_sistema, is_active),
  CONSTRAINT fk_sed_sistema FOREIGN KEY (id_sistema) REFERENCES sistema (id_sistema)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Whitelist dominios email por aplicación — OTP y validación altas';

INSERT IGNORE INTO sistema_email_domain (id_sistema, domain, is_active)
SELECT s.id_sistema, '305nofault.com', 1
FROM sistema s
WHERE s.system_code IN ('PORTAL_ABOGADOS', 'INTAKE', 'SECURITY_ADMIN');
