-- Backfill: comentarios legacy (tblLeadComments → lead_note) sin source → Intake
-- Solo note_type=comment; no toca snapshots intake/accident/hospital.
-- Idempotente: solo filas con source NULL o vacío.

UPDATE lead_note
SET source = 'case-manager'
WHERE note_type = 'comment'
  AND (source IS NULL OR TRIM(source) = '');
