-- Chat lead_note: paridad case_comment (mentions + notification recipients)
-- Solo aplica a note_type='comment'; snapshots dejan NULL.

ALTER TABLE lead_note
  ADD COLUMN mentions json DEFAULT NULL COMMENT '@user ids mencionados' AFTER source,
  ADD COLUMN recipient_user_ids json DEFAULT NULL COMMENT 'destinatarios notificación' AFTER mentions;
