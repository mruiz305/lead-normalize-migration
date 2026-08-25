-- role_name → is_leader (preferir: npm run patch:membership-is-leader)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE hierarchy_membership
  ADD COLUMN is_leader tinyint(1) NOT NULL DEFAULT 0 AFTER leader_user_id;

UPDATE hierarchy_membership
  SET is_leader = CASE WHEN role_name = 'Member' THEN 0 ELSE 1 END;

ALTER TABLE hierarchy_membership DROP INDEX uk_hierarchy_membership;
ALTER TABLE hierarchy_membership DROP INDEX idx_hm_role;
ALTER TABLE hierarchy_membership DROP COLUMN role_name;

ALTER TABLE hierarchy_membership
  ADD UNIQUE KEY uk_hierarchy_membership (user_id, id_hierarchy_level, id_company_office, leader_user_id, is_leader),
  ADD KEY idx_hm_is_leader (is_leader);

SET FOREIGN_KEY_CHECKS = 1;
