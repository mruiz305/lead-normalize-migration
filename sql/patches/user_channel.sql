-- user_channel — contactos del staff (tel, email, redes). npm run patch:user-channel

CREATE TABLE IF NOT EXISTS user_channel (
  id_channel int NOT NULL AUTO_INCREMENT,
  id_user int NOT NULL,
  id_channel_type smallint NOT NULL COMMENT 'FK ref_contact_channel_type',
  channel_value varchar(255) NOT NULL,
  channel_label varchar(100) DEFAULT NULL,
  is_primary tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Principal dentro del mismo medium',
  is_active tinyint(1) NOT NULL DEFAULT 1,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_user_id int DEFAULT NULL,
  updated_by_user_id int DEFAULT NULL,
  PRIMARY KEY (id_channel),
  UNIQUE KEY uk_user_channel (id_user, id_channel_type, channel_value(191)),
  KEY idx_user_channel_user (id_user),
  KEY idx_user_channel_type (id_channel_type),
  KEY idx_user_channel_value (channel_value(50)),
  KEY idx_user_channel_created_by (created_by_user_id),
  KEY idx_user_channel_updated_by (updated_by_user_id),
  CONSTRAINT fk_user_channel_user FOREIGN KEY (id_user) REFERENCES app_user (id_user),
  CONSTRAINT fk_user_channel_type FOREIGN KEY (id_channel_type) REFERENCES ref_contact_channel_type (id_channel_type),
  CONSTRAINT fk_user_channel_created_by FOREIGN KEY (created_by_user_id) REFERENCES app_user (id_user),
  CONSTRAINT fk_user_channel_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES app_user (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Contactos del staff (N por app_user; mismo catálogo que client_channel)';
