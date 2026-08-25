-- Metadatos de comentarios (paridad case_comment → lead_note note_type=comment)
-- document_id: clave S3 (Communication service)
-- source: origen UI (case-manager, attorney, etc.)
-- updated_at: edición dentro de ventana 1h

ALTER TABLE lead_note
  ADD COLUMN document_id varchar(512) DEFAULT NULL AFTER body,
  ADD COLUMN source varchar(128) DEFAULT NULL AFTER document_id,
  ADD COLUMN updated_at datetime(3) DEFAULT NULL AFTER posted_at;
