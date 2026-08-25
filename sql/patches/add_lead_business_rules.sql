-- Reglas de negocio leads: log status, CNV, catálogo legal/clinical.
-- Datos en TNFG (no SECURITY). UI admin vía Security API → INTAKE_DB.
-- Seed: sql/seeds/seed_business_rules_from_prod.sql

SET NAMES utf8mb4;

-- Catálogo semáforo del log (ACTIVE / DROPPED / REF OUT)
CREATE TABLE IF NOT EXISTS ref_log_status (
  id_log_status tinyint NOT NULL AUTO_INCREMENT,
  code varchar(20) NOT NULL,
  display_name varchar(50) NOT NULL,
  color_hex char(7) DEFAULT NULL,
  sort_order tinyint NOT NULL DEFAULT 0,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_log_status),
  UNIQUE KEY uk_log_status_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Estados del log del rep (semáforo)';

INSERT IGNORE INTO ref_log_status (code, display_name, color_hex, sort_order) VALUES
('ACTIVE',   'Active',   '#22C55E', 10),
('DROPPED',  'Dropped',  '#EF4444', 20),
('REF OUT',  'Ref out',  '#F97316', 30);

-- Lookup 6 dimensiones → id_log_status (migración tblLeadsLogsStatusRules)
CREATE TABLE IF NOT EXISTS ref_log_status_rule (
  id_log_status_rule smallint NOT NULL AUTO_INCREMENT,
  tag varchar(100) DEFAULT NULL,
  tx_location_alias varchar(100) NOT NULL,
  visits_alias varchar(100) NOT NULL,
  ldot_alias varchar(100) NOT NULL,
  accident_state_alias varchar(100) NOT NULL,
  legal_status_alias varchar(100) NOT NULL,
  clinical_status_alias varchar(100) NOT NULL,
  id_log_status tinyint NOT NULL,
  priority smallint NOT NULL DEFAULT 100,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  legacy_rule_id smallint DEFAULT NULL COMMENT 'tblLeadsLogsStatusRules.Id prod',
  created_by_user_id int DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_log_status_rule),
  KEY idx_log_rule_match (
    tx_location_alias, visits_alias, ldot_alias,
    accident_state_alias, legal_status_alias, clinical_status_alias, is_active
  ),
  KEY idx_log_rule_result (id_log_status),
  CONSTRAINT fk_log_rule_status FOREIGN KEY (id_log_status) REFERENCES ref_log_status (id_log_status),
  CONSTRAINT fk_log_rule_created_by FOREIGN KEY (created_by_user_id) REFERENCES app_user (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Reglas lookup estado del log (6 alias → resultado)';

-- Catálogo legal/clinical (migración tblLeadsStatusCatalog)
CREATE TABLE IF NOT EXISTS ref_status_catalog (
  id_status_catalog tinyint NOT NULL AUTO_INCREMENT,
  status_domain enum('legal','clinical') NOT NULL,
  value_normalized varchar(100) NOT NULL,
  description varchar(150) DEFAULT NULL,
  maps_to_legal_alias varchar(100) DEFAULT NULL COMMENT 'CONFIRMED, NO CASE, SIGNED',
  maps_to_clinical_alias varchar(100) DEFAULT NULL COMMENT 'ACTIVE, DROPPED, #N/A',
  legacy_catalog_id tinyint DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_status_catalog),
  UNIQUE KEY uk_status_catalog (status_domain, value_normalized)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Valores legal/clinical de GSheet y fuentes externas';

-- CNV por estado (migración refStates_cnv)
CREATE TABLE IF NOT EXISTS ref_state_cnv (
  id_state_cnv int NOT NULL AUTO_INCREMENT,
  id_state smallint NOT NULL,
  cnv_value decimal(4,2) NOT NULL DEFAULT 1.00,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  effective_from date DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_state_cnv),
  UNIQUE KEY uk_state_cnv_state (id_state),
  CONSTRAINT fk_state_cnv_state FOREIGN KEY (id_state) REFERENCES ref_state (id_state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Factor CNV por estado (esquema mayo 2026+)';

-- Reglas CNV cascada (migración gradual sp_cnv_value_result)
CREATE TABLE IF NOT EXISTS ref_cnv_rule (
  id_cnv_rule int NOT NULL AUTO_INCREMENT,
  rule_code varchar(80) NOT NULL,
  description varchar(250) NOT NULL,
  priority int NOT NULL COMMENT 'Mayor prioridad gana (como UPDATEs del SP)',
  cnv_value decimal(4,2) NOT NULL,
  condition_json json NOT NULL,
  effective_from date DEFAULT NULL,
  effective_to date DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_cnv_rule),
  UNIQUE KEY uk_cnv_rule_code (rule_code),
  KEY idx_cnv_rule_priority (is_active, priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Reglas CNV priorizadas (reemplazo sp_cnv_value_result)';

-- FK en lead
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead' AND COLUMN_NAME = 'id_log_status'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `lead` ADD COLUMN id_log_status tinyint DEFAULT NULL AFTER cnv_value,
   ADD KEY idx_lead_log_status (id_log_status),
   ADD CONSTRAINT fk_lead_log_status FOREIGN KEY (id_log_status) REFERENCES ref_log_status (id_log_status)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
