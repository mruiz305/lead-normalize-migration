-- Catálogo US + direcciones N por client. Aplicar con: npm run patch:state-address

CREATE TABLE IF NOT EXISTS ref_state (
  id_state smallint NOT NULL AUTO_INCREMENT,
  state_code char(2) NOT NULL,
  state_name varchar(100) NOT NULL,
  country_code char(2) NOT NULL DEFAULT 'US',
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_state),
  UNIQUE KEY uk_state_code (state_code),
  UNIQUE KEY uk_state_name (state_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Estados US (nombre completo + abreviatura)';

INSERT IGNORE INTO ref_state (id_state, state_code, state_name) VALUES
(1,'AL','Alabama'),(2,'AK','Alaska'),(3,'AZ','Arizona'),(4,'AR','Arkansas'),
(5,'CA','California'),(6,'CO','Colorado'),(7,'CT','Connecticut'),(8,'DE','Delaware'),
(9,'FL','Florida'),(10,'GA','Georgia'),(11,'HI','Hawaii'),(12,'ID','Idaho'),
(13,'IL','Illinois'),(14,'IN','Indiana'),(15,'IA','Iowa'),(16,'KS','Kansas'),
(17,'KY','Kentucky'),(18,'LA','Louisiana'),(19,'ME','Maine'),(20,'MD','Maryland'),
(21,'MA','Massachusetts'),(22,'MI','Michigan'),(23,'MN','Minnesota'),(24,'MS','Mississippi'),
(25,'MO','Missouri'),(26,'MT','Montana'),(27,'NE','Nebraska'),(28,'NV','Nevada'),
(29,'NH','New Hampshire'),(30,'NJ','New Jersey'),(31,'NM','New Mexico'),(32,'NY','New York'),
(33,'NC','North Carolina'),(34,'ND','North Dakota'),(35,'OH','Ohio'),(36,'OK','Oklahoma'),
(37,'OR','Oregon'),(38,'PA','Pennsylvania'),(39,'RI','Rhode Island'),(40,'SC','South Carolina'),
(41,'SD','South Dakota'),(42,'TN','Tennessee'),(43,'TX','Texas'),(44,'UT','Utah'),
(45,'VT','Vermont'),(46,'VA','Virginia'),(47,'WA','Washington'),(48,'WV','West Virginia'),
(49,'WI','Wisconsin'),(50,'WY','Wyoming'),(51,'DC','District of Columbia'),
(52,'PR','Puerto Rico'),(53,'VI','Virgin Islands'),(54,'GU','Guam');

CREATE TABLE IF NOT EXISTS ref_address_kind (
  id_address_kind tinyint NOT NULL AUTO_INCREMENT,
  kind_code varchar(20) NOT NULL,
  kind_label varchar(80) NOT NULL,
  sort_order tinyint NOT NULL DEFAULT 0,
  PRIMARY KEY (id_address_kind),
  UNIQUE KEY uk_address_kind_code (kind_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Tipo de dirección postal';

INSERT IGNORE INTO ref_address_kind (id_address_kind, kind_code, kind_label, sort_order) VALUES
(1,'RESIDENCE','Residencia',10),
(2,'MAILING','Correspondencia',20),
(3,'WORK','Trabajo',30),
(4,'OTHER','Otra',99);

CREATE TABLE IF NOT EXISTS client_address (
  id_address int NOT NULL AUTO_INCREMENT,
  id_client int NOT NULL,
  id_address_kind tinyint NOT NULL,
  street varchar(255) DEFAULT NULL,
  unit varchar(50) DEFAULT NULL,
  city varchar(100) DEFAULT NULL,
  id_state smallint DEFAULT NULL COMMENT 'FK ref_state',
  postal_code varchar(20) DEFAULT NULL,
  address_label varchar(100) DEFAULT NULL COMMENT 'Etiqueta libre',
  is_primary tinyint(1) NOT NULL DEFAULT 0,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_user_id int DEFAULT NULL,
  updated_by_user_id int DEFAULT NULL,
  PRIMARY KEY (id_address),
  KEY idx_client_address_client (id_client),
  KEY idx_client_address_kind (id_address_kind),
  KEY idx_client_address_state (id_state),
  CONSTRAINT fk_client_address_client FOREIGN KEY (id_client) REFERENCES client (id_client),
  CONSTRAINT fk_client_address_kind FOREIGN KEY (id_address_kind) REFERENCES ref_address_kind (id_address_kind),
  CONSTRAINT fk_client_address_state FOREIGN KEY (id_state) REFERENCES ref_state (id_state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Direcciones del client (N por persona)';
