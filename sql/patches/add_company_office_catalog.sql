-- Catálogo company + offices + hierarchy_membership v2 (ID-based office)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS ref_company (
  id_company int NOT NULL,
  company_name varchar(100) NOT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  synced_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_company)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ref_company_office (
  id_company_office int NOT NULL,
  id_company int NOT NULL,
  office_code varchar(50) NOT NULL,
  display_name varchar(100) DEFAULT NULL,
  capacity int DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  synced_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_company_office),
  UNIQUE KEY uk_company_office_code (office_code),
  KEY idx_company_office_company (id_company),
  CONSTRAINT fk_company_office_company FOREIGN KEY (id_company) REFERENCES ref_company (id_company)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS id_company_office int DEFAULT NULL AFTER office_code;

ALTER TABLE `lead`
  ADD COLUMN IF NOT EXISTS id_company_office int DEFAULT NULL AFTER id_stage;

ALTER TABLE lead_org_snapshot
  ADD COLUMN IF NOT EXISTS id_company_office int DEFAULT NULL AFTER office_code;

-- hierarchy_membership: migrar de org_unit_id a id_company_office + leader_user_id
-- En MySQL 8 sin IF NOT EXISTS en DROP — ejecutar manualmente si aplica:
-- ALTER TABLE hierarchy_membership DROP FOREIGN KEY fk_hm_node;
-- ALTER TABLE hierarchy_membership DROP COLUMN org_unit_id;

SET FOREIGN_KEY_CHECKS = 1;
