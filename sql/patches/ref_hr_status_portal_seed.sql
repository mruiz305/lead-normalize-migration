-- Catálogo HR Status (Portal User Management Edit User)
CREATE TABLE IF NOT EXISTS ref_hr_status (
  id_hr_status tinyint NOT NULL AUTO_INCREMENT,
  status_code varchar(20) NOT NULL COMMENT 'Valor formulario portal (active, termed)',
  display_name varchar(100) NOT NULL COMMENT 'Label UI y valor app_user.hr_status',
  sort_order tinyint NOT NULL DEFAULT 0,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_hr_status),
  UNIQUE KEY uk_hr_status_code (status_code),
  UNIQUE KEY uk_hr_status_display (display_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Estados HR editables en portal (antes hardcode Active/Termed)';

INSERT IGNORE INTO ref_hr_status (status_code, display_name, sort_order) VALUES
  ('active', 'Active', 1),
  ('termed', 'Termed', 2);
