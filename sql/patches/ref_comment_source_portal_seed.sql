-- Orígenes de comentarios (chat lead_note note_type=comment)
CREATE TABLE IF NOT EXISTS ref_comment_source (
  id_comment_source tinyint NOT NULL AUTO_INCREMENT,
  origin_code varchar(32) NOT NULL COMMENT 'Segmento origin en lead_note.source (antes de :)',
  display_name varchar(100) NOT NULL COMMENT 'Etiqueta UI del sistema que escribe',
  sort_order tinyint NOT NULL DEFAULT 0,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_comment_source),
  UNIQUE KEY uk_comment_source_origin (origin_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Catálogo de orígenes para chat lead_note (Intake, Attorney, Clinic, etc.)';

INSERT IGNORE INTO ref_comment_source (origin_code, display_name, sort_order) VALUES
  ('case-manager', 'Intake', 1),
  ('attorney', 'Attorney', 2),
  ('doctor', 'Clinic / Doctor', 3),
  ('clinic', 'Treatment Center', 4),
  ('system', 'System', 5);
