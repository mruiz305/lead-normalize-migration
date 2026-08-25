-- Catálogo abogado (modelo intake).

CREATE TABLE IF NOT EXISTS ref_attorney (
  id_attorney int NOT NULL,
  display_name varchar(255) NOT NULL,
  firm_name varchar(255) DEFAULT NULL,
  contract_group varchar(255) DEFAULT NULL,
  email_subject_prefix varchar(255) DEFAULT NULL,
  ext_email_targets text,
  internal_source varchar(255) DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  id_state smallint DEFAULT NULL,
  is_emails_enabled tinyint(1) NOT NULL DEFAULT 1,
  is_emails_ld_enabled tinyint(1) NOT NULL DEFAULT 1,
  is_misc tinyint(1) NOT NULL DEFAULT 0,
  is_standard tinyint(1) NOT NULL DEFAULT 1,
  is_active_on_portal tinyint(1) NOT NULL DEFAULT 1,
  updated_at datetime DEFAULT NULL,
  synced_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_attorney),
  KEY idx_attorney_display_name (display_name(100)),
  KEY idx_attorney_is_active (is_active),
  KEY idx_attorney_state (id_state),
  KEY idx_attorney_firm (firm_name(100)),
  CONSTRAINT fk_attorney_state FOREIGN KEY (id_state) REFERENCES ref_state (id_state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
