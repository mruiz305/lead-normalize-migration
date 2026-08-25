-- User Management: catálogos HR legacy + campos g_users en app_user
-- Origen: dbProduction.departments, ranks, g_users.systemDepartment / rank / HR amounts

CREATE TABLE IF NOT EXISTS ref_department (
  department_id int NOT NULL COMMENT 'departments.department_id',
  department_name varchar(100) NOT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  synced_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (department_id),
  UNIQUE KEY uk_ref_department_name (department_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Catálogo departamentos HR (legacy departments)';

CREATE TABLE IF NOT EXISTS ref_rank (
  rank_id int NOT NULL COMMENT 'ranks.rank_id',
  rank_name varchar(100) NOT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  synced_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (rank_id),
  UNIQUE KEY uk_ref_rank_name (rank_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Catálogo ranks HR (legacy ranks)';

CREATE TABLE IF NOT EXISTS ref_job_title (
  job_title_id int NOT NULL AUTO_INCREMENT,
  job_title_name varchar(100) NOT NULL COMMENT 'DISTINCT g_users.title',
  is_active tinyint(1) NOT NULL DEFAULT 1,
  synced_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (job_title_id),
  UNIQUE KEY uk_ref_job_title_name (job_title_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Catálogo job titles (derivado de g_users.title)';

ALTER TABLE app_user ADD COLUMN id_department int DEFAULT NULL COMMENT 'g_users.systemDepartment → FK' AFTER id_company_office;
ALTER TABLE app_user ADD COLUMN id_rank int DEFAULT NULL COMMENT 'g_users.rank → FK ref_rank' AFTER id_department;
ALTER TABLE app_user ADD COLUMN picture text DEFAULT NULL COMMENT 'g_users.picture' AFTER title;
ALTER TABLE app_user ADD COLUMN hr_ee_type varchar(100) DEFAULT NULL COMMENT 'g_users.hrEeType' AFTER picture;
ALTER TABLE app_user ADD COLUMN dob date DEFAULT NULL COMMENT 'g_users.dob' AFTER hr_ee_type;
ALTER TABLE app_user ADD COLUMN hr_deal_amount decimal(12,2) DEFAULT NULL COMMENT 'g_users.hrDealAmount' AFTER dob;
ALTER TABLE app_user ADD COLUMN hr_budget decimal(12,2) DEFAULT NULL COMMENT 'g_users.hrBudget' AFTER hr_deal_amount;
ALTER TABLE app_user ADD COLUMN boost_budget decimal(12,2) DEFAULT NULL COMMENT 'g_users.boostBudget' AFTER hr_budget;
ALTER TABLE app_user ADD COLUMN management_pay decimal(12,2) DEFAULT NULL COMMENT 'g_users.managementPay' AFTER boost_budget;
ALTER TABLE app_user ADD COLUMN hr_deal_goal decimal(12,2) DEFAULT NULL COMMENT 'COALESCE(g_users.DealGoal, g_users.hrDealGoal)' AFTER management_pay;
ALTER TABLE app_user ADD COLUMN user_time_zone varchar(255) DEFAULT NULL COMMENT 'Perfil público Glide' AFTER hr_deal_goal;
ALTER TABLE app_user ADD KEY idx_app_user_department (id_department);
ALTER TABLE app_user ADD KEY idx_app_user_rank (id_rank);
ALTER TABLE app_user ADD CONSTRAINT fk_app_user_department FOREIGN KEY (id_department) REFERENCES ref_department (department_id);
ALTER TABLE app_user ADD CONSTRAINT fk_app_user_rank FOREIGN KEY (id_rank) REFERENCES ref_rank (rank_id);
