-- Catálogo abogados normalizado. Aplicar con: npm run patch:normalize-attorney

CREATE TABLE IF NOT EXISTS ref_law_firm (
  id_firm int NOT NULL AUTO_INCREMENT,
  firm_name varchar(255) NOT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  synced_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_firm),
  UNIQUE KEY uk_law_firm_name (firm_name(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Firma / organización legal';

CREATE TABLE IF NOT EXISTS ref_attorney_profile (
  id_attorney_profile int NOT NULL COMMENT 'PK = prod refAttorneys.idAttorney',
  id_firm int NOT NULL,
  profile_code varchar(255) NOT NULL COMMENT 'Valor assignable (tblLeads.attorney)',
  display_name varchar(255) NOT NULL,
  contract_group varchar(255) DEFAULT NULL,
  internal_source varchar(255) DEFAULT NULL,
  status varchar(100) DEFAULT NULL,
  is_standard tinyint(1) NOT NULL DEFAULT 1,
  active_on_portal tinyint(1) NOT NULL DEFAULT 1,
  email_subject_prefix varchar(255) DEFAULT NULL,
  ext_email_targets text,
  emails_enabled tinyint(1) NOT NULL DEFAULT 1,
  emails_ld_enabled tinyint(1) NOT NULL DEFAULT 1,
  is_miscellaneous tinyint(1) NOT NULL DEFAULT 0,
  synced_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_attorney_profile),
  KEY idx_attorney_profile_code (profile_code(100)),
  KEY idx_attorney_profile_firm (id_firm),
  KEY idx_attorney_profile_status (status),
  CONSTRAINT fk_attorney_profile_firm FOREIGN KEY (id_firm) REFERENCES ref_law_firm (id_firm)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Perfil legal assignable al lead';

CREATE TABLE IF NOT EXISTS ref_attorney_state (
  id_attorney_profile int NOT NULL,
  id_state smallint NOT NULL,
  PRIMARY KEY (id_attorney_profile, id_state),
  KEY idx_attorney_state_state (id_state),
  CONSTRAINT fk_attorney_state_profile FOREIGN KEY (id_attorney_profile) REFERENCES ref_attorney_profile (id_attorney_profile),
  CONSTRAINT fk_attorney_state_ref FOREIGN KEY (id_state) REFERENCES ref_state (id_state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Estados donde opera el perfil';

CREATE TABLE IF NOT EXISTS ref_attorney_alias (
  id_alias int NOT NULL AUTO_INCREMENT,
  id_attorney_profile int NOT NULL,
  alias_text varchar(255) NOT NULL,
  alias_kind enum('CATALOG','DASHBOARD','LEGACY') NOT NULL DEFAULT 'CATALOG',
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_alias),
  UNIQUE KEY uk_attorney_alias_profile_text (id_attorney_profile, alias_text(191)),
  KEY idx_attorney_alias_text (alias_text(100)),
  CONSTRAINT fk_attorney_alias_profile FOREIGN KEY (id_attorney_profile) REFERENCES ref_attorney_profile (id_attorney_profile)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Nombres alternativos para resolver tblLeads.attorney';
