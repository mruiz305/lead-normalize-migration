-- Deal goal legacy (DealGoal / DealGoalCustom) + paylocityId desde g_users.

ALTER TABLE app_user
  MODIFY COLUMN hr_deal_goal decimal(12,2) DEFAULT NULL
    COMMENT 'COALESCE(g_users.DealGoal, g_users.hrDealGoal)';

ALTER TABLE app_user
  ADD COLUMN hr_deal_goal_custom decimal(12,2) DEFAULT NULL
    COMMENT 'g_users.DealGoalCustom' AFTER hr_deal_goal;

ALTER TABLE app_user
  ADD COLUMN paylocity_id varchar(20) DEFAULT NULL
    COMMENT 'g_users.paylocityId — payroll / machine output join' AFTER hr_deal_goal_custom;

ALTER TABLE app_user ADD KEY idx_app_user_paylocity_id (paylocity_id);
