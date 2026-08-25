-- Histórico HR por pasada laboral (reingresos). Preferir: npm run sync:user-hr

CREATE TABLE IF NOT EXISTS user_hr_period (
  period_id int NOT NULL AUTO_INCREMENT,
  id_user int NOT NULL,
  hr_status varchar(100) DEFAULT NULL,
  hired_at datetime DEFAULT NULL,
  termed_at datetime DEFAULT NULL,
  stint_order tinyint NOT NULL DEFAULT 1,
  is_current_stint tinyint(1) NOT NULL DEFAULT 0,
  synced_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (period_id),
  UNIQUE KEY uk_hr_period_user_stint (id_user, stint_order),
  KEY idx_hr_period_user (id_user),
  KEY idx_hr_period_hr_status (hr_status),
  CONSTRAINT fk_hr_period_user FOREIGN KEY (id_user) REFERENCES app_user (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
