-- g_users.rosterlastmonthFile → app_user.roster_last_month_file_url
-- Preferir: npm run patch:app-user-doc-urls  (idempotente)

ALTER TABLE app_user
  ADD COLUMN roster_last_month_file_url text DEFAULT NULL
    COMMENT 'g_users.rosterlastmonthFile'
    AFTER roster_file_url;
