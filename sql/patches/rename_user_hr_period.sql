-- Renombra app_user_employment_period → user_hr_period (MySQL 8+)

SET NAMES utf8mb4;

RENAME TABLE app_user_employment_period TO user_hr_period;

ALTER TABLE user_hr_period
  RENAME INDEX uk_employment_legacy_g_users TO uk_hr_period_legacy_g_users,
  RENAME INDEX idx_employment_user TO idx_hr_period_user,
  RENAME INDEX idx_employment_user_stint TO idx_hr_period_user_stint,
  RENAME INDEX idx_employment_hr_status TO idx_hr_period_hr_status;
