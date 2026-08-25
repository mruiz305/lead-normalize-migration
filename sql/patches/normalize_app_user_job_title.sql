-- Normaliza app_user: id_job_title FK en lugar de title texto

ALTER TABLE app_user ADD COLUMN id_job_title int DEFAULT NULL COMMENT 'g_users.title → FK ref_job_title' AFTER phone;

UPDATE app_user u
JOIN ref_job_title jt ON LOWER(TRIM(jt.job_title_name)) = LOWER(TRIM(u.title))
SET u.id_job_title = jt.job_title_id
WHERE u.id_job_title IS NULL AND u.title IS NOT NULL AND TRIM(u.title) <> '';

ALTER TABLE app_user DROP COLUMN title;
ALTER TABLE app_user ADD KEY idx_app_user_job_title (id_job_title);
ALTER TABLE app_user ADD CONSTRAINT fk_app_user_job_title FOREIGN KEY (id_job_title) REFERENCES ref_job_title (job_title_id);
