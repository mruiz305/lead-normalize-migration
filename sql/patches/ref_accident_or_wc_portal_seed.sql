-- Accident vs Workers Comp — opciones Edit Lead / New Lead intake
CREATE TABLE IF NOT EXISTS ref_accident_or_wc (
  id_accident_or_wc tinyint NOT NULL AUTO_INCREMENT,
  type_code varchar(30) NOT NULL COMMENT 'Stable code: accident | workers_comp',
  display_name varchar(100) NOT NULL COMMENT 'Value stored in lead.accident_or_wc',
  tx_group varchar(50) DEFAULT NULL COMMENT 'Matches ref_tx_location.tx_group (Workers Comp filter)',
  sort_order tinyint NOT NULL DEFAULT 0,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_accident_or_wc),
  UNIQUE KEY uk_accident_or_wc_code (type_code),
  UNIQUE KEY uk_accident_or_wc_name (display_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Portal Accident vs Workers Comp toggle';

INSERT IGNORE INTO ref_accident_or_wc (type_code, display_name, tx_group, sort_order) VALUES
  ('accident', 'Accident', NULL, 1),
  ('workers_comp', 'Workers Comp', 'Workers Comp', 2);
