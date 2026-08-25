-- app_user limpio: quitar hierarchy_* y office_code (duplican membership + FK oficina)
-- Preferir: npm run patch:clean-app-user

ALTER TABLE app_user DROP INDEX idx_app_user_hierarchy_office;
ALTER TABLE app_user DROP INDEX idx_app_user_office_code;
ALTER TABLE app_user
  DROP COLUMN hierarchy_directorate,
  DROP COLUMN hierarchy_region,
  DROP COLUMN hierarchy_office,
  DROP COLUMN hierarchy_pod,
  DROP COLUMN hierarchy_team,
  DROP COLUMN hierarchy_duo,
  DROP COLUMN office_code;
