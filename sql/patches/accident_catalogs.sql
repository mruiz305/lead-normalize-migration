-- Catálogos accidente + FK en lead_accident. npm run patch:accident-catalogs

CREATE TABLE IF NOT EXISTS ref_accident_location_type (
  id_location_type tinyint NOT NULL,
  type_code char(3) NOT NULL,
  type_label varchar(50) NOT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_location_type),
  UNIQUE KEY uk_accident_location_code (type_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO ref_accident_location_type (id_location_type, type_code, type_label) VALUES
  (1, 'UNK', 'Unknown'),
  (2, 'AFF', 'At-fault location'),
  (3, 'COR', 'Corporate')
ON DUPLICATE KEY UPDATE type_label = VALUES(type_label);

CREATE TABLE IF NOT EXISTS ref_at_fault_type (
  id_at_fault_type smallint NOT NULL AUTO_INCREMENT,
  display_name varchar(100) NOT NULL,
  normalized_name varchar(100) NOT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_at_fault_type),
  UNIQUE KEY uk_at_fault_normalized (normalized_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
