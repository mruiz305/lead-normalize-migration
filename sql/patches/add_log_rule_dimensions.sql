-- Dimensiones de reglas por ID + overrides + FKs en catálogos existentes.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS ref_log_rule_dimension (
  id_dimension tinyint NOT NULL AUTO_INCREMENT,
  dimension_type enum('TX_LOCATION','VISITS','LDOT','ACCIDENT_STATE','LEGAL','CLINICAL') NOT NULL,
  value_code varchar(40) NOT NULL,
  display_name varchar(80) NOT NULL,
  sort_order tinyint NOT NULL DEFAULT 0,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_dimension),
  UNIQUE KEY uk_rule_dim (dimension_type, value_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Valores normalizados para match de reglas log (por ID, no texto)';

INSERT IGNORE INTO ref_log_rule_dimension (id_dimension, dimension_type, value_code, display_name, sort_order) VALUES
(1,  'TX_LOCATION',    'COR_AFF',      'COR/AFF',       10),
(2,  'TX_LOCATION',    'REF_OUT',      'REF OUT',       20),
(3,  'TX_LOCATION',    'WORKERS_COMP', 'Workers Comp',  30),
(4,  'VISITS',         'LT_12V',       '<12V',           10),
(5,  'VISITS',         'GTE_12V',      '>=12V',          20),
(6,  'VISITS',         'NA',           'N/A',            30),
(7,  'LDOT',           'LT_30D',       '<30D',           10),
(8,  'LDOT',           'GT_30D',       '>30D',           20),
(9,  'LDOT',           'GT_60D',       '>60D',           30),
(10, 'ACCIDENT_STATE', 'PIP',          'PIP STATE',      10),
(11, 'ACCIDENT_STATE', 'NON_PIP',      'NON PIP STATE',  20),
(12, 'LEGAL',          'CONFIRMED',    'CONFIRMED',      10),
(13, 'LEGAL',          'NO_CASE',      'NO CASE',        20),
(14, 'LEGAL',          'SIGNED',       'SIGNED',         30),
(15, 'CLINICAL',       'ACTIVE',       'ACTIVE',         10),
(16, 'CLINICAL',       'DROPPED',      'DROPPED',        20),
(17, 'CLINICAL',       'NA',           '#N/A',           30);

-- FKs en catálogos operativos → dimensión de regla
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='refLegalStatus' AND COLUMN_NAME='id_legal_rule_dim');
SET @sql := IF(@col=0, 'ALTER TABLE refLegalStatus ADD COLUMN id_legal_rule_dim tinyint DEFAULT NULL, ADD KEY idx_legal_rule_dim (id_legal_rule_dim)', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='refClinicalStatus' AND COLUMN_NAME='id_clinical_rule_dim');
SET @sql := IF(@col=0, 'ALTER TABLE refClinicalStatus ADD COLUMN id_clinical_rule_dim tinyint DEFAULT NULL, ADD KEY idx_clinical_rule_dim (id_clinical_rule_dim)', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ref_tx_location' AND COLUMN_NAME='id_tx_rule_dim');
SET @sql := IF(@col=0, 'ALTER TABLE ref_tx_location ADD COLUMN id_tx_rule_dim tinyint DEFAULT NULL, ADD KEY idx_tx_rule_dim (id_tx_rule_dim)', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ref_state' AND COLUMN_NAME='id_accident_rule_dim');
SET @sql := IF(@col=0, 'ALTER TABLE ref_state ADD COLUMN id_accident_rule_dim tinyint DEFAULT NULL, ADD KEY idx_accident_rule_dim (id_accident_rule_dim)', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE refLegalStatus SET id_legal_rule_dim = 14 WHERE legalStatus IN ('Signed','Pending','Scheduled','Finalized','Settled') AND id_legal_rule_dim IS NULL;
UPDATE refLegalStatus SET id_legal_rule_dim = 13 WHERE legalStatus IN ('No Case','Dropped','No Show') AND id_legal_rule_dim IS NULL;

INSERT INTO refLegalStatus (legalStatus, id_legal_rule_dim)
SELECT 'CONFIRMED', 12 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM refLegalStatus WHERE legalStatus = 'CONFIRMED');

INSERT INTO refLegalStatus (legalStatus, id_legal_rule_dim)
SELECT 'NO CASE - CLIENT AT FAULT', 13 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM refLegalStatus WHERE legalStatus = 'NO CASE - CLIENT AT FAULT');

UPDATE refLegalStatus SET id_legal_rule_dim = 13 WHERE legalStatus = 'NO CASE - CLIENT AT FAULT' AND id_legal_rule_dim IS NULL;

UPDATE refClinicalStatus SET id_clinical_rule_dim = 16 WHERE clinicalStatus = 'Dropped' AND id_clinical_rule_dim IS NULL;
UPDATE refClinicalStatus SET id_clinical_rule_dim = 15 WHERE id_clinical_rule_dim IS NULL;

UPDATE ref_state SET id_accident_rule_dim = 10 WHERE state_code IN ('NY','NJ','FL') AND id_accident_rule_dim IS NULL;
UPDATE ref_state SET id_accident_rule_dim = 11 WHERE id_accident_rule_dim IS NULL;

UPDATE ref_tx_location SET id_tx_rule_dim = 2 WHERE UPPER(display_name) IN ('REFERRED OUT','REF OUT') AND id_tx_rule_dim IS NULL;
UPDATE ref_tx_location SET id_tx_rule_dim = 3 WHERE UPPER(display_name) = 'WORKERS COMP' AND id_tx_rule_dim IS NULL;
UPDATE ref_tx_location SET id_tx_rule_dim = 1 WHERE id_tx_rule_dim IS NULL;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ref_status_catalog' AND COLUMN_NAME='id_legal_rule_dim');
SET @sql := IF(@col=0, 'ALTER TABLE ref_status_catalog ADD COLUMN id_legal_rule_dim tinyint DEFAULT NULL', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ref_status_catalog' AND COLUMN_NAME='id_clinical_rule_dim');
SET @sql := IF(@col=0, 'ALTER TABLE ref_status_catalog ADD COLUMN id_clinical_rule_dim tinyint DEFAULT NULL', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE ref_status_catalog SET id_legal_rule_dim = 12 WHERE LOWER(value_normalized) = 'confirmed' AND id_legal_rule_dim IS NULL;
UPDATE ref_status_catalog SET id_legal_rule_dim = 14 WHERE LOWER(value_normalized) = 'signed' AND id_legal_rule_dim IS NULL;
UPDATE ref_status_catalog SET id_legal_rule_dim = 13 WHERE LOWER(value_normalized) LIKE 'no case%' AND id_legal_rule_dim IS NULL;
UPDATE ref_status_catalog SET id_clinical_rule_dim = 15 WHERE status_domain = 'clinical' AND LOWER(value_normalized) = 'active' AND id_clinical_rule_dim IS NULL;
UPDATE ref_status_catalog SET id_clinical_rule_dim = 16 WHERE status_domain = 'clinical' AND LOWER(value_normalized) = 'dropped' AND id_clinical_rule_dim IS NULL;

-- Columnas FK en reglas lookup (conviven con alias legacy hasta migración)
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ref_log_status_rule' AND COLUMN_NAME='id_tx_dim');
SET @sql := IF(@col=0, 'ALTER TABLE ref_log_status_rule
  ADD COLUMN id_tx_dim tinyint DEFAULT NULL,
  ADD COLUMN id_visits_dim tinyint DEFAULT NULL,
  ADD COLUMN id_ldot_dim tinyint DEFAULT NULL,
  ADD COLUMN id_accident_dim tinyint DEFAULT NULL,
  ADD COLUMN id_legal_dim tinyint DEFAULT NULL,
  ADD COLUMN id_clinical_dim tinyint DEFAULT NULL,
  ADD KEY idx_log_rule_dims (id_tx_dim, id_visits_dim, id_ldot_dim, id_accident_dim, id_legal_dim, id_clinical_dim, is_active)', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE ref_log_status_rule SET id_tx_dim = 1 WHERE tx_location_alias = 'COR/AFF' AND id_tx_dim IS NULL;
UPDATE ref_log_status_rule SET id_tx_dim = 2 WHERE tx_location_alias = 'REF OUT' AND id_tx_dim IS NULL;
UPDATE ref_log_status_rule SET id_tx_dim = 3 WHERE tx_location_alias = 'Workers Comp' AND id_tx_dim IS NULL;
UPDATE ref_log_status_rule SET id_visits_dim = 4 WHERE visits_alias = '<12V' AND id_visits_dim IS NULL;
UPDATE ref_log_status_rule SET id_visits_dim = 5 WHERE visits_alias = '>=12V' AND id_visits_dim IS NULL;
UPDATE ref_log_status_rule SET id_visits_dim = 6 WHERE visits_alias = 'N/A' AND id_visits_dim IS NULL;
UPDATE ref_log_status_rule SET id_ldot_dim = 7 WHERE ldot_alias = '<30D' AND id_ldot_dim IS NULL;
UPDATE ref_log_status_rule SET id_ldot_dim = 8 WHERE ldot_alias = '>30D' AND id_ldot_dim IS NULL;
UPDATE ref_log_status_rule SET id_ldot_dim = 9 WHERE ldot_alias = '>60D' AND id_ldot_dim IS NULL;
UPDATE ref_log_status_rule SET id_accident_dim = 10 WHERE accident_state_alias = 'PIP STATE' AND id_accident_dim IS NULL;
UPDATE ref_log_status_rule SET id_accident_dim = 11 WHERE accident_state_alias = 'NON PIP STATE' AND id_accident_dim IS NULL;
UPDATE ref_log_status_rule SET id_legal_dim = 12 WHERE legal_status_alias = 'CONFIRMED' AND id_legal_dim IS NULL;
UPDATE ref_log_status_rule SET id_legal_dim = 13 WHERE legal_status_alias = 'NO CASE' AND id_legal_dim IS NULL;
UPDATE ref_log_status_rule SET id_legal_dim = 14 WHERE legal_status_alias = 'SIGNED' AND id_legal_dim IS NULL;
UPDATE ref_log_status_rule SET id_clinical_dim = 15 WHERE clinical_status_alias = 'ACTIVE' AND id_clinical_dim IS NULL;
UPDATE ref_log_status_rule SET id_clinical_dim = 16 WHERE clinical_status_alias = 'DROPPED' AND id_clinical_dim IS NULL;
UPDATE ref_log_status_rule SET id_clinical_dim = 17 WHERE clinical_status_alias = '#N/A' AND id_clinical_dim IS NULL;

CREATE TABLE IF NOT EXISTS ref_log_status_override_rule (
  id_override_rule smallint NOT NULL AUTO_INCREMENT,
  rule_code varchar(80) NOT NULL,
  description varchar(250) NOT NULL,
  priority int NOT NULL COMMENT 'Menor primero; última que aplica gana',
  id_log_status tinyint NOT NULL,
  condition_json json NOT NULL COMMENT 'Condiciones por ID de catálogo',
  is_active tinyint(1) NOT NULL DEFAULT 1,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_override_rule),
  UNIQUE KEY uk_override_rule_code (rule_code),
  KEY idx_override_priority (is_active, priority),
  CONSTRAINT fk_override_log_status FOREIGN KEY (id_log_status) REFERENCES ref_log_status (id_log_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Overrides post-lookup log status (Florida, non-FL, etc.)';
