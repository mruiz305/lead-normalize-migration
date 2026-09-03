-- Catálogo de plaza/mercado (g_users.SubOffice) — distinto de ref_company_office.
-- Valores mezclan códigos (ATL, TMP) y nombres (MIAMI, ORLANDO); no son 1:1 con office_code.

CREATE TABLE IF NOT EXISTS ref_sub_office (
  id_sub_office int NOT NULL AUTO_INCREMENT,
  sub_office_code varchar(50) NOT NULL COMMENT 'Valor canónico g_users.SubOffice (trim)',
  display_name varchar(100) DEFAULT NULL COMMENT 'Nombre legible (default = code)',
  is_active tinyint(1) NOT NULL DEFAULT 1,
  synced_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_sub_office),
  UNIQUE KEY uk_ref_sub_office_code (sub_office_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Plaza/mercado SubOffice (no es oficina operativa)';

-- app_user FK (idempotente vía procedure-like checks en apply script)
