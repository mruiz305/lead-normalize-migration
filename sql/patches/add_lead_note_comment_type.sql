-- lead_note: tipo comment (tblLeadComments). npm run sync:lead-comments

ALTER TABLE lead_note
  MODIFY note_type enum('intake','accident','hospital','comment') NOT NULL;

-- Snapshots legacy (1 fila/tipo desde tblLeads) fuera del rango idComment prod (~357k)
UPDATE lead_note
SET id_note = id_note + 4000000
WHERE note_type IN ('intake', 'accident', 'hospital')
  AND id_note < 4000000;

ALTER TABLE lead_note AUTO_INCREMENT = 4000000;
