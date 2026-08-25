-- Patch: FKs de jerarquía en lead_org_snapshot + catálogo de seguros
-- Ejecutar en TNFG_INTAKE si ya tienes bootstrap anterior sin estos objetos.
-- Recomendado: npm run bootstrap (recrea todo) + copy-catalogs + copy-users + migrate

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS ref_insurance_carrier (
  id_carrier int NOT NULL AUTO_INCREMENT,
  carrier_name varchar(255) NOT NULL,
  normalized_name varchar(255) NOT NULL,
  catalog_scope enum('PIP','AT_FAULT') NOT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_carrier),
  UNIQUE KEY uk_carrier_scope (normalized_name, catalog_scope),
  KEY idx_carrier_name (carrier_name(100)),
  KEY idx_carrier_scope (catalog_scope)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE lead_org_snapshot
  ADD COLUMN IF NOT EXISTS directorate_node_id int DEFAULT NULL AFTER id_lead,
  ADD COLUMN IF NOT EXISTS region_node_id int DEFAULT NULL AFTER directorate_node_id,
  ADD COLUMN IF NOT EXISTS office_node_id int DEFAULT NULL AFTER region_node_id,
  ADD COLUMN IF NOT EXISTS pod_node_id int DEFAULT NULL AFTER office_node_id,
  ADD COLUMN IF NOT EXISTS team_node_id int DEFAULT NULL AFTER pod_node_id,
  ADD COLUMN IF NOT EXISTS duo_node_id int DEFAULT NULL AFTER team_node_id;

-- MySQL < 8.0.12 no soporta IF NOT EXISTS en ADD COLUMN; si falla, omitir columnas ya existentes.

CREATE TABLE IF NOT EXISTS lead_insurance (
  id_lead_insurance int NOT NULL AUTO_INCREMENT,
  id_lead int NOT NULL,
  id_lead_party int DEFAULT NULL,
  insurance_role enum('PIP','AT_FAULT','PASSENGER') NOT NULL,
  party_sequence tinyint DEFAULT NULL,
  carrier_raw varchar(255) DEFAULT NULL,
  id_carrier int DEFAULT NULL,
  PRIMARY KEY (id_lead_insurance),
  KEY idx_lead_insurance_lead (id_lead),
  KEY idx_lead_insurance_carrier (id_carrier),
  KEY idx_lead_insurance_party (id_lead_party),
  CONSTRAINT fk_lead_insurance_lead FOREIGN KEY (id_lead) REFERENCES `lead` (id_lead),
  CONSTRAINT fk_lead_insurance_party FOREIGN KEY (id_lead_party) REFERENCES lead_party (id_lead_party),
  CONSTRAINT fk_lead_insurance_carrier FOREIGN KEY (id_carrier) REFERENCES ref_insurance_carrier (id_carrier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
