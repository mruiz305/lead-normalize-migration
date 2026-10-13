-- Identidad de origen para los comentarios que vienen de Glide.
--
-- Hasta ahora el sync escribía id_note = idComment de prod y reanudaba desde
-- MAX(id_note). Eso dejó de funcionar cuando el portal empezó a escribir sus
-- propios comentarios en lead_note con ids AUTO_INCREMENT: el máximo quedó por
-- encima del último idComment de prod y la ventana "idComment > cursor" quedó
-- vacía para siempre. Además id_note compartía rango con los snapshots
-- intake/accident/hospital, y INSERT IGNORE descartaba en silencio cada
-- comentario cuyo idComment ya estaba ocupado.
--
-- glide_comment_id es la identidad de Glide, separada de la PK local, igual
-- que lead.glide_id. La PK la asigna siempre la base.
ALTER TABLE lead_note
  ADD COLUMN glide_comment_id int unsigned DEFAULT NULL
    COMMENT 'idComment en prod.tblLeadComments — NULL si nació en el portal'
    AFTER id_note,
  ADD UNIQUE KEY uk_lead_note_glide_comment (glide_comment_id),
  ALGORITHM=INPLACE, LOCK=NONE;
