-- SpecialList (override log/CNV) + grupos estado legacy A/B (pre-2026).
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS ref_special_list (
  id_special_list int NOT NULL AUTO_INCREMENT,
  lead_key varchar(100) NOT NULL COMMENT 'id_lead, id_lead_old o legacy id como string',
  status_code enum('ACTIVE','DROPPED') NOT NULL,
  notes varchar(255) DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  legacy_id varchar(100) DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_special_list),
  UNIQUE KEY uk_special_list_lead_key (lead_key),
  KEY idx_special_list_status (status_code, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Override manual log status (migración SpecialList prod)';

CREATE TABLE IF NOT EXISTS ref_cnv_state_group (
  id_state smallint NOT NULL,
  group_code enum('A','B') NOT NULL COMMENT 'A=0.5, B=0.33 esquema pre-2026',
  cnv_value decimal(4,2) NOT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_state, group_code),
  CONSTRAINT fk_cnv_state_group_state FOREIGN KEY (id_state) REFERENCES ref_state (id_state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Penalización por estado antes de 2026-01-01';

-- Grupo A (0.5) — vCnvStatesGroupA prod
INSERT IGNORE INTO ref_cnv_state_group (id_state, group_code, cnv_value)
SELECT id_state, 'A', 0.50 FROM ref_state WHERE state_name IN (
  'Connecticut','Kentucky','Louisiana','Montana','Nevada',
  'North Dakota','Ohio','Utah','Washington','Wyoming'
);

-- Grupo B (0.33) — vCnvStatesGroupB prod (aplica después de A; gana en overlap)
INSERT IGNORE INTO ref_cnv_state_group (id_state, group_code, cnv_value)
SELECT id_state, 'B', 0.33 FROM ref_state WHERE state_name IN (
  'Maryland','Virginia','Washington','Rhode Island','Louisiana'
);

CREATE TABLE IF NOT EXISTS ref_attorney_cnv_exclude (
  id_attorney int NOT NULL,
  reason varchar(150) DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_attorney),
  CONSTRAINT fk_attorney_cnv_exclude FOREIGN KEY (id_attorney) REFERENCES ref_attorney (id_attorney)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Abogados excluidos regla CONFIRMED+special (vw_refattorneys_exclude_confirmed_rule)';
