-- Modelo limpio: eliminar hierarchy_node y columnas FK redundantes.
-- Preferir: npm run patch:clean-model (scripts/apply-clean-model-patch.js)
-- Este SQL es referencia; MySQL 8 no soporta DROP FOREIGN KEY IF EXISTS en todas las versiones.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE `lead` DROP FOREIGN KEY fk_lead_office;
ALTER TABLE `lead` DROP INDEX idx_lead_office;
ALTER TABLE `lead` DROP COLUMN owning_office_node_id;

ALTER TABLE lead_org_snapshot DROP FOREIGN KEY fk_org_dir_node;
ALTER TABLE lead_org_snapshot DROP FOREIGN KEY fk_org_reg_node;
ALTER TABLE lead_org_snapshot DROP FOREIGN KEY fk_org_off_node;
ALTER TABLE lead_org_snapshot DROP FOREIGN KEY fk_org_pod_node;
ALTER TABLE lead_org_snapshot DROP FOREIGN KEY fk_org_team_node;
ALTER TABLE lead_org_snapshot DROP FOREIGN KEY fk_org_duo_node;
ALTER TABLE lead_org_snapshot DROP INDEX idx_org_office_node;
ALTER TABLE lead_org_snapshot DROP INDEX idx_org_team_node;
ALTER TABLE lead_org_snapshot
  DROP COLUMN directorate_node_id,
  DROP COLUMN region_node_id,
  DROP COLUMN office_node_id,
  DROP COLUMN pod_node_id,
  DROP COLUMN team_node_id,
  DROP COLUMN duo_node_id;

DROP TABLE IF EXISTS hierarchy_node;

SET FOREIGN_KEY_CHECKS = 1;
