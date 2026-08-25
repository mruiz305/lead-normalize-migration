-- Normaliza app_user: catálogos por FK (id_rank) en lugar de texto (rank)

ALTER TABLE app_user ADD COLUMN id_rank int DEFAULT NULL COMMENT 'g_users.rank → FK ref_rank' AFTER id_department;

UPDATE app_user u
JOIN ref_rank r ON LOWER(TRIM(r.rank_name)) = LOWER(TRIM(u.`rank`))
SET u.id_rank = r.rank_id
WHERE u.id_rank IS NULL AND u.`rank` IS NOT NULL AND TRIM(u.`rank`) <> '';

ALTER TABLE app_user DROP COLUMN `rank`;
ALTER TABLE app_user ADD KEY idx_app_user_rank (id_rank);
ALTER TABLE app_user ADD CONSTRAINT fk_app_user_rank FOREIGN KEY (id_rank) REFERENCES ref_rank (rank_id);
