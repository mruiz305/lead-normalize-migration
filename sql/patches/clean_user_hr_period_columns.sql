-- Quita columnas legacy/redundantes de user_hr_period.
-- Aplicar con: npm run patch:clean-user-hr

-- Índices legacy (nombres posibles según versión anterior)
-- ALTER TABLE user_hr_period DROP INDEX uk_employment_legacy_g_users;
-- ALTER TABLE user_hr_period DROP INDEX uk_hr_period_legacy_g_users;
-- ALTER TABLE user_hr_period DROP INDEX idx_employment_user_stint;

-- ALTER TABLE user_hr_period
--   DROP COLUMN legacy_g_users_id,
--   DROP COLUMN email,
--   DROP COLUMN display_name,
--   DROP COLUMN source;

-- ALTER TABLE user_hr_period
--   ADD UNIQUE KEY uk_hr_period_user_stint (id_user, stint_order);
