-- Patch: hierarchy_membership (usuario ↔ catálogo office + leader_user_id)
-- Para destinos sin user_org_memberships ni hierarchy_membership.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS hierarchy_membership (
  membership_id int NOT NULL AUTO_INCREMENT,
  user_id int NOT NULL,
  id_hierarchy_level tinyint NOT NULL,
  id_company_office int DEFAULT NULL,
  leader_user_id int DEFAULT NULL,
  is_leader tinyint(1) NOT NULL DEFAULT 0,
  is_primary tinyint(1) NOT NULL DEFAULT 0,
  start_date date DEFAULT NULL,
  end_date date DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  synced_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (membership_id),
  UNIQUE KEY uk_hierarchy_membership (user_id, id_hierarchy_level, id_company_office, leader_user_id, is_leader),
  KEY idx_hm_user (user_id),
  KEY idx_hm_level (id_hierarchy_level),
  KEY idx_hm_company_office (id_company_office),
  KEY idx_hm_leader (leader_user_id),
  KEY idx_hm_is_leader (is_leader),
  CONSTRAINT fk_hm_user FOREIGN KEY (user_id) REFERENCES app_user (id_user),
  CONSTRAINT fk_hm_level FOREIGN KEY (id_hierarchy_level) REFERENCES hierarchy_level (id_hierarchy_level),
  CONSTRAINT fk_hm_company_office FOREIGN KEY (id_company_office) REFERENCES ref_company_office (id_company_office),
  CONSTRAINT fk_hm_leader FOREIGN KEY (leader_user_id) REFERENCES app_user (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
