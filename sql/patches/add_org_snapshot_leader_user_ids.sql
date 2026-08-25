-- Patch: lead_org_snapshot — congelar id_user del líder por nivel
-- (region/office/pod/team/duo/directorate). El texto legacy se mantiene.
-- Idempotente. Aplicar: npm run patch:org-snapshot-leader-ids
--
-- Backfill: email legacy → app_user.id_user (LOWER(TRIM(...))).

SET NAMES utf8mb4;

-- Columnas (MySQL 8+). Si ADD falla por existir, el script JS salta.
ALTER TABLE lead_org_snapshot
  ADD COLUMN directorate_user_id int DEFAULT NULL
    COMMENT 'app_user.id_user del líder directorate al crear' AFTER directorate_name,
  ADD COLUMN region_user_id int DEFAULT NULL
    COMMENT 'app_user.id_user del líder region al crear' AFTER region_name,
  ADD COLUMN office_user_id int DEFAULT NULL
    COMMENT 'app_user.id_user del líder office al crear' AFTER office_legacy,
  ADD COLUMN pod_user_id int DEFAULT NULL
    COMMENT 'app_user.id_user del líder pod al crear' AFTER pod_name,
  ADD COLUMN team_user_id int DEFAULT NULL
    COMMENT 'app_user.id_user del líder team al crear' AFTER team_name,
  ADD COLUMN duo_user_id int DEFAULT NULL
    COMMENT 'app_user.id_user del líder duo al crear' AFTER duo_name;

ALTER TABLE lead_org_snapshot
  ADD KEY idx_org_snapshot_region_user (region_user_id),
  ADD KEY idx_org_snapshot_office_user (office_user_id),
  ADD KEY idx_org_snapshot_pod_user (pod_user_id),
  ADD KEY idx_org_snapshot_team_user (team_user_id),
  ADD KEY idx_org_snapshot_duo_user (duo_user_id),
  ADD KEY idx_org_snapshot_directorate_user (directorate_user_id);

-- Backfill desde emails congelados (join por igualdad; emails ya normalizados)
UPDATE lead_org_snapshot org
INNER JOIN app_user u ON u.email = org.directorate
SET org.directorate_user_id = u.id_user
WHERE org.directorate_user_id IS NULL;

UPDATE lead_org_snapshot org
INNER JOIN app_user u ON u.email = org.region
SET org.region_user_id = u.id_user
WHERE org.region_user_id IS NULL;

UPDATE lead_org_snapshot org
INNER JOIN app_user u ON u.email = org.office_legacy
SET org.office_user_id = u.id_user
WHERE org.office_user_id IS NULL;

UPDATE lead_org_snapshot org
INNER JOIN app_user u ON u.email = org.office_code
SET org.office_user_id = u.id_user
WHERE org.office_user_id IS NULL;

UPDATE lead_org_snapshot org
INNER JOIN app_user u ON u.email = org.pod
SET org.pod_user_id = u.id_user
WHERE org.pod_user_id IS NULL;

UPDATE lead_org_snapshot org
INNER JOIN app_user u ON u.email = org.team
SET org.team_user_id = u.id_user
WHERE org.team_user_id IS NULL;

UPDATE lead_org_snapshot org
INNER JOIN app_user u ON u.email = org.duo
SET org.duo_user_id = u.id_user
WHERE org.duo_user_id IS NULL;
