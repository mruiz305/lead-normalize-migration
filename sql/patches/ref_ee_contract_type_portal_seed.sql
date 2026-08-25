-- Catálogo EE Contract Type (Portal User Management Create)
CREATE TABLE IF NOT EXISTS ref_ee_contract_type (
  id_ee_contract_type smallint NOT NULL AUTO_INCREMENT,
  type_code varchar(20) NOT NULL COMMENT 'Valor en app_user.hr_ee_type (g_users.hrEeType)',
  display_name varchar(100) NOT NULL,
  sort_order tinyint NOT NULL DEFAULT 0,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_ee_contract_type),
  UNIQUE KEY uk_ee_contract_type_code (type_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Tipos contrato HR del portal (antes hardcode W2/1099)';

INSERT IGNORE INTO ref_ee_contract_type (type_code, display_name, sort_order) VALUES
  ('W2', 'W2', 1),
  ('1099', '1099', 2),
  ('INTM', 'INTM', 3),
  ('INTM2', 'INTM2', 4);
