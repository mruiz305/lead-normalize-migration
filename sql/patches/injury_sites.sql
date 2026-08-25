-- ref_injury_site + lead_injury_site; drop injuries CSV. npm run patch:injury-sites

CREATE TABLE IF NOT EXISTS ref_injury_site (
  id_injury_site smallint NOT NULL AUTO_INCREMENT,
  display_name varchar(100) NOT NULL,
  normalized_name varchar(100) NOT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_injury_site),
  UNIQUE KEY uk_injury_site_normalized (normalized_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lead_injury_site (
  id_lead int NOT NULL,
  id_injury_site smallint NOT NULL,
  PRIMARY KEY (id_lead, id_injury_site),
  KEY idx_lead_injury_site_site (id_injury_site),
  CONSTRAINT fk_lead_injury_site_lead FOREIGN KEY (id_lead) REFERENCES `lead` (id_lead),
  CONSTRAINT fk_lead_injury_site_ref FOREIGN KEY (id_injury_site) REFERENCES ref_injury_site (id_injury_site)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
