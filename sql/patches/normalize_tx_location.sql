-- ref_tx_location (modelo intake). npm run patch:normalize-tx-location

CREATE TABLE IF NOT EXISTS ref_tx_location (
  id_tx_location int NOT NULL COMMENT 'PK = prod idTXLocation',
  display_name varchar(255) NOT NULL,
  tx_group varchar(255) DEFAULT NULL,
  location_type_code varchar(100) DEFAULT NULL,
  address text,
  int_email_targets text,
  ext_email_targets text,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  id_state smallint DEFAULT NULL,
  is_active_on_portal tinyint(1) NOT NULL DEFAULT 0,
  coordinates point NOT NULL,
  is_emails_enabled tinyint(1) NOT NULL DEFAULT 1,
  is_emails_ld_enabled tinyint(1) NOT NULL DEFAULT 1,
  synced_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_tx_location),
  KEY idx_tx_location_display_name (display_name(100)),
  KEY idx_tx_location_tx_group (tx_group(100)),
  KEY idx_tx_location_is_active (is_active),
  KEY idx_tx_location_state (id_state),
  CONSTRAINT fk_tx_location_state FOREIGN KEY (id_state) REFERENCES ref_state (id_state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
