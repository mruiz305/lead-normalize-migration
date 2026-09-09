-- Llave de sync g_users → app_user: rowId (legacy_row_id), no email.
-- Email deja de ser UNIQUE (prod tiene ~45 emails duplicados con rowId distinto).
-- Campos de negocio que faltaban: nick, referred_by.

ALTER TABLE app_user
  ADD COLUMN nick varchar(100) DEFAULT NULL COMMENT 'g_users.nick — display alternativo' AFTER display_name,
  ADD COLUMN referred_by varchar(150) DEFAULT NULL COMMENT 'g_users.Referred_By' AFTER individual_lead_sheet_url;

ALTER TABLE app_user ADD UNIQUE KEY uk_app_user_legacy_row_id (legacy_row_id);

ALTER TABLE app_user DROP INDEX uk_app_user_email;
ALTER TABLE app_user ADD KEY idx_app_user_email (email);
