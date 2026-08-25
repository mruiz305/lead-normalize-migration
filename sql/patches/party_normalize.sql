-- lead_party: drop insurance/injuries varchar; severidad FK + lead_party_injury_site. npm run patch:party-normalize

CREATE TABLE IF NOT EXISTS lead_party_injury_site (
  id_lead_party int NOT NULL,
  id_injury_site smallint NOT NULL,
  PRIMARY KEY (id_lead_party, id_injury_site),
  KEY idx_party_injury_site_site (id_injury_site),
  CONSTRAINT fk_party_injury_site_party FOREIGN KEY (id_lead_party) REFERENCES lead_party (id_lead_party),
  CONSTRAINT fk_party_injury_site_ref FOREIGN KEY (id_injury_site) REFERENCES ref_injury_site (id_injury_site)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Sitios de lesión por copasajero (N:M ref_injury_site)';

-- id_personal_severity (nullable; solo copasajeros cuando aplica)
SET @has_sev := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead_party' AND COLUMN_NAME = 'id_personal_severity'
);
SET @sql_sev := IF(@has_sev = 0,
  'ALTER TABLE lead_party ADD COLUMN id_personal_severity tinyint DEFAULT NULL COMMENT ''FK ref_severity_level (copasajero)'' AFTER appointment_at',
  'SELECT 1');
PREPARE stmt FROM @sql_sev;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_fk := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead_party' AND CONSTRAINT_NAME = 'fk_lead_party_personal_sev'
);
SET @sql_fk := IF(@has_fk = 0,
  'ALTER TABLE lead_party ADD CONSTRAINT fk_lead_party_personal_sev FOREIGN KEY (id_personal_severity) REFERENCES ref_severity_level (id_severity)',
  'SELECT 1');
PREPARE stmt FROM @sql_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_uk := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead_party' AND INDEX_NAME = 'uk_lead_party_kind_seq'
);
SET @sql_uk := IF(@has_uk = 0,
  'ALTER TABLE lead_party ADD UNIQUE KEY uk_lead_party_kind_seq (id_lead, id_party_kind, party_sequence)',
  'SELECT 1');
PREPARE stmt FROM @sql_uk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
