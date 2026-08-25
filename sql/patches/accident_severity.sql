-- ref_severity_level + FK severidad en lead_accident; vehicle_description. npm run patch:accident-severity

CREATE TABLE IF NOT EXISTS ref_severity_level (
  id_severity tinyint NOT NULL,
  severity_code varchar(20) NOT NULL,
  severity_label varchar(50) NOT NULL,
  sort_order tinyint NOT NULL DEFAULT 0,
  normalized_name varchar(50) NOT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_severity),
  UNIQUE KEY uk_severity_code (severity_code),
  UNIQUE KEY uk_severity_normalized (normalized_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO ref_severity_level (id_severity, severity_code, severity_label, sort_order, normalized_name) VALUES
  (1, 'MILD', 'Mild', 1, 'mild'),
  (2, 'MODERATE', 'Moderate', 2, 'moderate'),
  (3, 'HIGH', 'High', 3, 'high'),
  (4, 'MAJOR', 'Major', 4, 'major')
ON DUPLICATE KEY UPDATE severity_label = VALUES(severity_label);
