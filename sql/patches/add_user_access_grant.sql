-- Permisos explícitos adicionales (user_access_grant)

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS user_access_grant (
  grant_id int NOT NULL AUTO_INCREMENT,
  user_id int NOT NULL,
  id_hierarchy_level tinyint NOT NULL,
  id_company_office int DEFAULT NULL,
  leader_user_id int DEFAULT NULL,
  access_level enum('VIEW','EDIT','ADMIN') NOT NULL DEFAULT 'VIEW',
  can_export tinyint(1) NOT NULL DEFAULT 0,
  valid_from datetime DEFAULT NULL,
  valid_to datetime DEFAULT NULL,
  reason varchar(255) DEFAULT NULL,
  granted_by_user_id int DEFAULT NULL,
  updated_by_user_id int DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (grant_id),
  UNIQUE KEY uk_access_grant_scope (user_id, id_hierarchy_level, id_company_office, leader_user_id),
  KEY idx_grant_user (user_id),
  KEY idx_grant_level (id_hierarchy_level),
  KEY idx_grant_office (id_company_office),
  KEY idx_grant_leader (leader_user_id),
  KEY idx_grant_active (is_active, valid_from, valid_to),
  CONSTRAINT fk_grant_user FOREIGN KEY (user_id) REFERENCES app_user (id_user),
  CONSTRAINT fk_grant_level FOREIGN KEY (id_hierarchy_level) REFERENCES hierarchy_level (id_hierarchy_level),
  CONSTRAINT fk_grant_office FOREIGN KEY (id_company_office) REFERENCES ref_company_office (id_company_office),
  CONSTRAINT fk_grant_leader FOREIGN KEY (leader_user_id) REFERENCES app_user (id_user),
  CONSTRAINT fk_grant_granted_by FOREIGN KEY (granted_by_user_id) REFERENCES app_user (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
