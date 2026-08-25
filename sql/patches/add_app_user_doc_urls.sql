-- URLs operativas por empleado (Google Drive / sheets) desde g_users.
-- Preferir: npm run patch:app-user-doc-urls

ALTER TABLE app_user
  ADD COLUMN individual_log_url text DEFAULT NULL COMMENT 'g_users.logsIndividualFile',
  ADD COLUMN roster_file_url text DEFAULT NULL COMMENT 'g_users.rosterIndividualFile',
  ADD COLUMN machine_file_url text DEFAULT NULL COMMENT 'g_users.machineIndividual',
  ADD COLUMN lead_sheet_url text DEFAULT NULL COMMENT 'g_users.leadSheetURL',
  ADD COLUMN individual_lead_sheet_url text DEFAULT NULL COMMENT 'g_users.individualLeadSheetURL';
