-- Esquema limpio lead_status_event. Aplicar con: npm run patch:clean-lead-status-event

ALTER TABLE lead_status_event
  DROP INDEX uk_lse_legacy,
  DROP COLUMN status_from_text,
  DROP COLUMN status_to_text,
  DROP COLUMN changed_by_key,
  DROP COLUMN legacy_source,
  DROP COLUMN legacy_source_id;
