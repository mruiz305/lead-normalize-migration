-- Catálogo de tipos de contacto (1 tabla). Aplicar con: npm run patch:contact-channel

CREATE TABLE IF NOT EXISTS ref_contact_channel_type (
  id_channel_type smallint NOT NULL AUTO_INCREMENT,
  medium_code varchar(20) NOT NULL,
  type_code varchar(50) NOT NULL,
  type_label varchar(100) NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_channel_type),
  UNIQUE KEY uk_contact_channel_type_code (type_code),
  KEY idx_contact_channel_medium (medium_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO ref_contact_channel_type (id_channel_type, medium_code, type_code, type_label, sort_order) VALUES
(1,'PHONE','PHONE_MOBILE','Móvil / principal',10),
(2,'PHONE','PHONE_HOME','Casa',20),
(3,'PHONE','PHONE_WORK','Trabajo',30),
(4,'PHONE','PHONE_WORK_EXT','Extensión trabajo',35),
(5,'PHONE','PHONE_OTHER','Otro teléfono',40),
(6,'PHONE','PHONE_INTAKE_RAW','Intake — tal como se ingresó',90),
(7,'PHONE','PHONE_INTAKE_FORMATTED','Intake — formateado',91),
(10,'EMAIL','EMAIL_PERSONAL','Email personal',10),
(11,'EMAIL','EMAIL_WORK','Email trabajo',20),
(12,'EMAIL','EMAIL_OTHER','Otro email',30),
(20,'MESSAGING','SMS','SMS',10),
(21,'MESSAGING','WHATSAPP','WhatsApp',20),
(22,'MESSAGING','TELEGRAM','Telegram',30),
(23,'MESSAGING','SIGNAL','Signal',40),
(24,'MESSAGING','IMESSAGE','iMessage',50),
(30,'SOCIAL','SOCIAL_FACEBOOK','Facebook',10),
(31,'SOCIAL','SOCIAL_INSTAGRAM','Instagram',20),
(32,'SOCIAL','SOCIAL_TWITTER','X / Twitter',30),
(33,'SOCIAL','SOCIAL_LINKEDIN','LinkedIn',40),
(34,'SOCIAL','SOCIAL_TIKTOK','TikTok',50),
(35,'SOCIAL','SOCIAL_OTHER','Otra red social',99),
(40,'FAX','FAX','Fax',10),
(50,'WEB','WEB_URL','Sitio web',10),
(51,'WEB','WEB_PORTAL','Portal / perfil',20);
