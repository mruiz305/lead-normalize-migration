-- Aplicar en destino existente sin re-bootstrap completo.
-- Luego: npm run truncate && npm run migrate

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS lead_org_snapshot (
  id_lead int NOT NULL,
  directorate varchar(100) DEFAULT NULL,
  directorate_name varchar(255) DEFAULT NULL,
  region varchar(100) DEFAULT NULL,
  region_name varchar(255) DEFAULT NULL,
  office_code varchar(100) DEFAULT NULL COMMENT 'officeLabel — oficina del caso al crear',
  office_name varchar(255) DEFAULT NULL,
  office_legacy varchar(100) DEFAULT NULL COMMENT 'tblLeads.office si difiere de officeLabel',
  pod varchar(100) DEFAULT NULL,
  pod_name varchar(255) DEFAULT NULL,
  team varchar(100) DEFAULT NULL,
  team_name varchar(255) DEFAULT NULL,
  duo varchar(100) DEFAULT NULL,
  duo_name varchar(255) DEFAULT NULL,
  PRIMARY KEY (id_lead),
  KEY idx_org_snapshot_office (office_code),
  KEY idx_org_snapshot_team (team),
  CONSTRAINT fk_lead_org_snapshot FOREIGN KEY (id_lead) REFERENCES `lead` (id_lead)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Snapshot org del lead al crear; independiente de app_user';
