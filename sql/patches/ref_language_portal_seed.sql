-- Catálogo de idiomas preferidos (Portal New Lead / Demographics)
CREATE TABLE IF NOT EXISTS ref_language (
  id_language smallint NOT NULL AUTO_INCREMENT,
  display_name varchar(100) NOT NULL,
  normalized_name varchar(100) NOT NULL,
  sort_order tinyint NOT NULL DEFAULT 0,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_language),
  UNIQUE KEY uk_language_normalized (normalized_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Idiomas preferidos del portal (antes hardcode)';

INSERT IGNORE INTO ref_language (display_name, normalized_name, sort_order) VALUES
  ('English', 'english', 1),
  ('Spanish', 'spanish', 2),
  ('Creole', 'creole', 3),
  ('Portuguese', 'portuguese', 4),
  ('Other', 'other', 5);
