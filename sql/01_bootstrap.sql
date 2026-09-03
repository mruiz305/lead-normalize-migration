-- =============================================================================
-- Bootstrap v2 — modelo TNFG intake (convención propia, no replica TNFG legacy)
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS log_detail;
DROP TABLE IF EXISTS entity_log;
DROP TABLE IF EXISTS import_reject;
DROP TABLE IF EXISTS lead_note;
DROP TABLE IF EXISTS lead_status_event;
DROP TABLE IF EXISTS lead_sync_flag;
DROP TABLE IF EXISTS lead_staff;
DROP TABLE IF EXISTS lead_insurance;
DROP TABLE IF EXISTS lead_party_injury_site;
DROP TABLE IF EXISTS lead_party;
DROP TABLE IF EXISTS lead_org_snapshot;
DROP TABLE IF EXISTS lead_timeline;
DROP TABLE IF EXISTS lead_injury;
DROP TABLE IF EXISTS lead_injury_site;
DROP TABLE IF EXISTS ref_injury_site;
DROP TABLE IF EXISTS lead_clinical;
DROP TABLE IF EXISTS lead_legal;
DROP TABLE IF EXISTS lead_accident;
DROP TABLE IF EXISTS ref_severity_level;
DROP TABLE IF EXISTS ref_ee_contract_type;
DROP TABLE IF EXISTS ref_language;
DROP TABLE IF EXISTS ref_at_fault_type;
DROP TABLE IF EXISTS ref_accident_location_type;
DROP TABLE IF EXISTS client_address;
DROP TABLE IF EXISTS client_location;
DROP TABLE IF EXISTS client_channel;
DROP TABLE IF EXISTS ref_contact_channel_type;
DROP TABLE IF EXISTS ref_address_kind;
DROP TABLE IF EXISTS ref_state;
DROP TABLE IF EXISTS client;
DROP TABLE IF EXISTS `lead`;
DROP TABLE IF EXISTS hierarchy_membership;
DROP TABLE IF EXISTS user_access_grant;
DROP TABLE IF EXISTS user_hr_period;
DROP TABLE IF EXISTS user_channel;
DROP TABLE IF EXISTS app_user;
DROP TABLE IF EXISTS ref_job_title;
DROP TABLE IF EXISTS ref_rank;
DROP TABLE IF EXISTS ref_department;
DROP TABLE IF EXISTS staff_kind;
DROP TABLE IF EXISTS hierarchy_level;
DROP TABLE IF EXISTS party_kind;
-- esquemas anteriores
DROP TABLE IF EXISTS migration_exception;
DROP TABLE IF EXISTS lead_process_flag;
DROP TABLE IF EXISTS lead_assignment;
DROP TABLE IF EXISTS lead_participant;
DROP TABLE IF EXISTS lead_lifecycle;
DROP TABLE IF EXISTS injury_detail;
DROP TABLE IF EXISTS treatment_case;
DROP TABLE IF EXISTS legal_case;
DROP TABLE IF EXISTS accident;
DROP TABLE IF EXISTS person_address;
DROP TABLE IF EXISTS person_contact;
DROP TABLE IF EXISTS person;
DROP TABLE IF EXISTS org_unit;
DROP TABLE IF EXISTS assignment_role;
DROP TABLE IF EXISTS org_type;
DROP TABLE IF EXISTS participant_type;
DROP TABLE IF EXISTS lead_workflow;
DROP TABLE IF EXISTS lead_passenger;
DROP TABLE IF EXISTS lead_medical;
DROP TABLE IF EXISTS lead_case_snapshot;
DROP TABLE IF EXISTS lead_org_snapshot;
DROP TABLE IF EXISTS lead_address;
DROP TABLE IF EXISTS lead_contact;
DROP TABLE IF EXISTS lead_client;

DROP TABLE IF EXISTS ref_insurance_carrier;
DROP TABLE IF EXISTS ref_lead_stage;
DROP TABLE IF EXISTS refLegalStatus;
DROP TABLE IF EXISTS refClinicalStatus;
DROP TABLE IF EXISTS refLeadStatus;
DROP TABLE IF EXISTS ref_attorney;
DROP TABLE IF EXISTS ref_tx_location;
DROP TABLE IF EXISTS refTXLocations;
DROP TABLE IF EXISTS ref_company_office;
DROP TABLE IF EXISTS ref_company;

-- Catálogos producción (copy-catalogs)
CREATE TABLE ref_company (
  id_company int NOT NULL COMMENT 'tblCompany.idcompany',
  company_name varchar(100) NOT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  synced_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_company)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Compañía (1800 NO FAULT, ICP…) — catálogo prod';

CREATE TABLE ref_company_office (
  id_company_office int NOT NULL COMMENT 'tblCompanyOffices.idCompanyOffice',
  id_company int NOT NULL,
  office_code varchar(50) NOT NULL COMMENT 'tblCompanyOffices.officeName — join con officeLabel / g_users.office',
  display_name varchar(100) DEFAULT NULL COMMENT 'Nombre legible; solo en catálogo, no en jerarquía',
  capacity int DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  synced_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_company_office),
  UNIQUE KEY uk_company_office_code (office_code),
  KEY idx_company_office_company (id_company),
  CONSTRAINT fk_company_office_company FOREIGN KEY (id_company) REFERENCES ref_company (id_company)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Oficinas con ID estable; nombres solo aquí';

CREATE TABLE ref_sub_office (
  id_sub_office int NOT NULL AUTO_INCREMENT,
  sub_office_code varchar(50) NOT NULL COMMENT 'Valor canónico g_users.SubOffice (trim)',
  display_name varchar(100) DEFAULT NULL COMMENT 'Nombre legible (default = code)',
  is_active tinyint(1) NOT NULL DEFAULT 1,
  synced_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_sub_office),
  UNIQUE KEY uk_ref_sub_office_code (sub_office_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Plaza/mercado SubOffice (no es oficina operativa)';

CREATE TABLE ref_department (
  department_id int NOT NULL COMMENT 'departments.department_id',
  department_name varchar(100) NOT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  synced_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (department_id),
  UNIQUE KEY uk_ref_department_name (department_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Catálogo departamentos HR (legacy departments)';

CREATE TABLE ref_rank (
  rank_id int NOT NULL COMMENT 'ranks.rank_id',
  rank_name varchar(100) NOT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  synced_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (rank_id),
  UNIQUE KEY uk_ref_rank_name (rank_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Catálogo ranks HR (legacy ranks)';

CREATE TABLE ref_job_title (
  job_title_id int NOT NULL AUTO_INCREMENT,
  job_title_name varchar(100) NOT NULL COMMENT 'DISTINCT g_users.title',
  is_active tinyint(1) NOT NULL DEFAULT 1,
  synced_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (job_title_id),
  UNIQUE KEY uk_ref_job_title_name (job_title_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Catálogo job titles (derivado de g_users.title)';

CREATE TABLE ref_language (
  id_language smallint NOT NULL AUTO_INCREMENT,
  display_name varchar(100) NOT NULL,
  normalized_name varchar(100) NOT NULL,
  sort_order tinyint NOT NULL DEFAULT 0,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_language),
  UNIQUE KEY uk_language_normalized (normalized_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Idiomas preferidos del portal (antes hardcode)';

INSERT INTO ref_language (display_name, normalized_name, sort_order) VALUES
  ('English', 'english', 1),
  ('Spanish', 'spanish', 2),
  ('Creole', 'creole', 3),
  ('Portuguese', 'portuguese', 4),
  ('Other', 'other', 5);

CREATE TABLE ref_ee_contract_type (
  id_ee_contract_type smallint NOT NULL AUTO_INCREMENT,
  type_code varchar(20) NOT NULL COMMENT 'Valor en app_user.hr_ee_type (g_users.hrEeType)',
  display_name varchar(100) NOT NULL,
  sort_order tinyint NOT NULL DEFAULT 0,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_ee_contract_type),
  UNIQUE KEY uk_ee_contract_type_code (type_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Tipos contrato HR del portal (antes hardcode W2/1099)';

INSERT INTO ref_ee_contract_type (type_code, display_name, sort_order) VALUES
  ('W2', 'W2', 1),
  ('1099', '1099', 2),
  ('INTM', 'INTM', 3),
  ('INTM2', 'INTM2', 4);

CREATE TABLE refLeadStatus (
  idLeadStatus int NOT NULL AUTO_INCREMENT,
  leadStatus varchar(100) DEFAULT NULL,
  icon varchar(2048) DEFAULT NULL,
  leadOrder int DEFAULT NULL,
  portal_tab_scope enum('hidden','case_manager','active_leads','both') NOT NULL DEFAULT 'hidden'
    COMMENT 'Portal Case Manager / Active Leads tabs — hidden = no mostrar',
  portal_edit_action_label varchar(50) DEFAULT NULL
    COMMENT 'Portal Edit Lead quick action button label; NULL = no button',
  portal_edit_action_order int DEFAULT NULL
    COMMENT 'Portal Edit Lead button sort order; independent from leadOrder (tabs)',
  PRIMARY KEY (idLeadStatus),
  UNIQUE KEY uk_lead_status (leadStatus),
  KEY idx_ref_lead_status_portal_tab (portal_tab_scope)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE refClinicalStatus (
  idClinicalStatus int NOT NULL AUTO_INCREMENT,
  icon varchar(2048) DEFAULT NULL,
  clinicalStatus varchar(50) DEFAULT NULL,
  PRIMARY KEY (idClinicalStatus),
  UNIQUE KEY uk_clinical_status (clinicalStatus)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE refLegalStatus (
  idLegalStatus int NOT NULL AUTO_INCREMENT,
  legalStatus varchar(100) DEFAULT NULL,
  icon varchar(2048) DEFAULT NULL,
  PRIMARY KEY (idLegalStatus),
  UNIQUE KEY uk_legal_status (legalStatus)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ref_lead_stage (
  id_stage tinyint NOT NULL AUTO_INCREMENT,
  stage_code varchar(50) NOT NULL,
  stage_label varchar(100) NOT NULL,
  sort_order tinyint DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_stage),
  UNIQUE KEY uk_stage_code (stage_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ref_insurance_carrier (
  id_carrier int NOT NULL AUTO_INCREMENT,
  carrier_name varchar(255) NOT NULL,
  normalized_name varchar(255) NOT NULL,
  catalog_scope enum('PIP','AT_FAULT') NOT NULL COMMENT 'prod refInsurance.type: Insurance / At Fualt',
  is_active tinyint(1) NOT NULL DEFAULT 1,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_carrier),
  UNIQUE KEY uk_carrier_scope (normalized_name, catalog_scope),
  KEY idx_carrier_name (carrier_name(100)),
  KEY idx_carrier_scope (catalog_scope)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Catálogo seguros: dos picklists prod (PIP + at-fault)';

CREATE TABLE ref_accident_location_type (
  id_location_type tinyint NOT NULL,
  type_code char(3) NOT NULL,
  type_label varchar(50) NOT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_location_type),
  UNIQUE KEY uk_accident_location_code (type_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Prod locationType: UNK/UKN/AFF/COR';

INSERT INTO ref_accident_location_type (id_location_type, type_code, type_label) VALUES
  (1, 'UNK', 'Unknown'),
  (2, 'AFF', 'At-fault location'),
  (3, 'COR', 'Corporate');

CREATE TABLE ref_at_fault_type (
  id_at_fault_type smallint NOT NULL AUTO_INCREMENT,
  display_name varchar(100) NOT NULL,
  normalized_name varchar(100) NOT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_at_fault_type),
  UNIQUE KEY uk_at_fault_normalized (normalized_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Prod refAtFaultTypes — atFaultType / atFaultSubType';

CREATE TABLE ref_severity_level (
  id_severity tinyint NOT NULL,
  severity_code varchar(20) NOT NULL,
  severity_label varchar(50) NOT NULL,
  sort_order tinyint NOT NULL DEFAULT 0,
  normalized_name varchar(50) NOT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  applies_property tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Catálogo Property Damage',
  applies_personal tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Catálogo Personal Injury',
  portal_code_property varchar(10) DEFAULT NULL COMMENT 'Código Portal Property (0, 0b, 1…)',
  portal_code_personal varchar(10) DEFAULT NULL COMMENT 'Código Portal Personal (0, 1…)',
  display_label_property varchar(80) DEFAULT NULL COMMENT 'Label UI Property Damage',
  display_label_personal varchar(80) DEFAULT NULL COMMENT 'Label UI Personal Injury',
  PRIMARY KEY (id_severity),
  UNIQUE KEY uk_severity_code (severity_code),
  UNIQUE KEY uk_severity_normalized (normalized_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Severidad propertyDamage / personalInjury (Mild…Major)';

INSERT INTO ref_severity_level (
  id_severity, severity_code, severity_label, sort_order, normalized_name,
  applies_property, applies_personal,
  portal_code_property, portal_code_personal,
  display_label_property, display_label_personal
) VALUES
  (0, 'NA', 'N/A', 0, 'na', 1, 1, '0', '0', 'N/A (0 out of 4)', 'N/A (0 out of 3)'),
  (5, 'NO_VISIBLE', 'No Visible Damage', 1, 'no_visible_damage', 1, 0, '0b', NULL, 'No Visible Damage (0 out of 4)', NULL),
  (1, 'MILD', 'Mild', 2, 'mild', 1, 1, '1', '1', 'Mild (1 out of 4)', 'Mild (1 out of 3)'),
  (2, 'MODERATE', 'Moderate', 3, 'moderate', 1, 1, '2', '2', 'Moderate (2 out of 4)', 'Moderate (2 out of 3)'),
  (3, 'HIGH', 'High', 4, 'high', 1, 1, '3', '3', 'High (3 out of 4)', 'High (3 out of 3)'),
  (4, 'MAJOR', 'Major', 5, 'major', 1, 0, '4', NULL, 'Major (4 out of 4)', NULL);

-- Catálogo de tipos de contacto (medium_code agrupa: PHONE, EMAIL, SOCIAL…)
CREATE TABLE ref_contact_channel_type (
  id_channel_type smallint NOT NULL AUTO_INCREMENT,
  medium_code varchar(20) NOT NULL COMMENT 'PHONE, EMAIL, MESSAGING, SOCIAL, FAX, WEB',
  type_code varchar(50) NOT NULL COMMENT 'PHONE_MOBILE, EMAIL_WORK, SOCIAL_INSTAGRAM, …',
  type_label varchar(100) NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_channel_type),
  UNIQUE KEY uk_contact_channel_type_code (type_code),
  KEY idx_contact_channel_medium (medium_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Tipo de contacto del client (teléfono casa/trabajo, email, WhatsApp, …)';

-- Catálogos propios (app)
CREATE TABLE party_kind (
  id_party_kind tinyint NOT NULL AUTO_INCREMENT,
  kind_code varchar(50) NOT NULL,
  kind_label varchar(100) NOT NULL,
  display_order tinyint DEFAULT NULL,
  PRIMARY KEY (id_party_kind),
  UNIQUE KEY uk_party_kind_code (kind_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE hierarchy_level (
  id_hierarchy_level tinyint NOT NULL AUTO_INCREMENT,
  level_code varchar(50) NOT NULL,
  level_label varchar(100) NOT NULL,
  level_rank tinyint NOT NULL,
  PRIMARY KEY (id_hierarchy_level),
  UNIQUE KEY uk_hierarchy_level_code (level_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE staff_kind (
  id_staff_kind tinyint NOT NULL AUTO_INCREMENT,
  kind_code varchar(50) NOT NULL,
  kind_label varchar(100) NOT NULL,
  PRIMARY KEY (id_staff_kind),
  UNIQUE KEY uk_staff_kind_code (kind_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cliente / contacto
CREATE TABLE client (
  id_client int NOT NULL AUTO_INCREMENT,
  first_name varchar(100) DEFAULT NULL,
  last_name varchar(100) DEFAULT NULL,
  display_name varchar(255) DEFAULT NULL,
  date_of_birth date DEFAULT NULL,
  is_minor tinyint(1) NOT NULL DEFAULT 0,
  preferred_language varchar(100) DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_user_id int DEFAULT NULL,
  updated_by_user_id int DEFAULT NULL,
  id_linked_user int DEFAULT NULL COMMENT 'FK app_user — mismo humano es empleado TNFG',
  PRIMARY KEY (id_client),
  KEY idx_client_name (last_name, first_name),
  KEY idx_client_created_by (created_by_user_id),
  KEY idx_client_updated_by (updated_by_user_id),
  KEY idx_client_linked_user (id_linked_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE client_channel (
  id_channel int NOT NULL AUTO_INCREMENT,
  id_client int NOT NULL,
  id_channel_type smallint NOT NULL COMMENT 'FK ref_contact_channel_type',
  channel_value varchar(255) NOT NULL,
  channel_label varchar(100) DEFAULT NULL COMMENT 'Notas libres ej. "llamar después de 5pm"',
  is_primary tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Principal dentro del mismo medium',
  is_active tinyint(1) NOT NULL DEFAULT 1,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_user_id int DEFAULT NULL,
  updated_by_user_id int DEFAULT NULL,
  PRIMARY KEY (id_channel),
  UNIQUE KEY uk_client_channel (id_client, id_channel_type, channel_value(191)),
  KEY idx_client_channel_type (id_channel_type),
  KEY idx_client_channel_value (channel_value(50)),
  KEY idx_channel_created_by (created_by_user_id),
  KEY idx_channel_updated_by (updated_by_user_id),
  CONSTRAINT fk_channel_client FOREIGN KEY (id_client) REFERENCES client (id_client),
  CONSTRAINT fk_channel_type FOREIGN KEY (id_channel_type) REFERENCES ref_contact_channel_type (id_channel_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Contactos del client (N por persona; tipo en catálogo)';

CREATE TABLE ref_state (
  id_state smallint NOT NULL COMMENT 'Legacy refStates.idState (1-50 US states)',
  state_code char(2) NOT NULL,
  state_name varchar(100) NOT NULL,
  capitol varchar(100) DEFAULT NULL COMMENT 'refStates.Capitol',
  accepts_at_fault tinyint(1) NOT NULL DEFAULT 0 COMMENT 'refStates.acceptsAtFault Yes=1',
  has_pip tinyint(1) NOT NULL DEFAULT 0 COMMENT 'refStates.hasPIP Yes=1',
  country_code char(2) NOT NULL DEFAULT 'US',
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_state),
  UNIQUE KEY uk_state_code (state_code),
  UNIQUE KEY uk_state_name (state_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Estados US — alineado con dbProduction.refStates';

INSERT INTO ref_state (id_state, state_code, state_name, capitol, accepts_at_fault, has_pip) VALUES
(1,'AL','Alabama','Montgomery',0,0),(2,'AK','Alaska','Juneau',0,0),(3,'AZ','Arizona','Phoenix',0,0),
(4,'AR','Arkansas','Little Rock',0,1),(5,'CA','California','Sacramento',0,0),(6,'CO','Colorado','Denver',0,0),
(7,'CT','Connecticut','Hartford',0,0),(8,'DE','Delaware','Dover',0,1),(9,'FL','Florida','Tallahassee',1,1),
(10,'GA','Georgia','Atlanta',0,0),(11,'HI','Hawaii','Honolulu',0,1),(12,'ID','Idaho','Boise',0,0),
(13,'IL','Illinois','Springfield',0,0),(14,'IN','Indiana','Indianapolis',0,0),(15,'IA','Iowa','Des Moines',0,0),
(16,'KS','Kansas','Topeka',0,1),(17,'KY','Kentucky','Frankfort',0,1),(18,'LA','Louisiana','Baton Rouge',0,0),
(19,'ME','Maine','Augusta',0,0),(20,'MD','Maryland','Annapolis',0,1),(21,'MA','Massachusetts','Boston',0,1),
(22,'MI','Michigan','Lansing',0,1),(23,'MN','Minnesota','Saint Paul',0,1),(24,'MS','Mississippi','Jackson',0,0),
(25,'MO','Missouri','Jefferson City',0,0),(26,'MT','Montana','Helena',0,0),(27,'NE','Nebraska','Lincoln',0,0),
(28,'NV','Nevada','Carson City',0,0),(29,'NH','New Hampshire','Concord',0,0),(30,'NJ','New Jersey','Trenton',1,1),
(31,'NM','New Mexico','Santa Fe',0,0),(32,'NY','New York','Albany',1,1),(33,'NC','North Carolina','Raleigh',0,0),
(34,'ND','North Dakota','Bismarck',0,1),(35,'OH','Ohio','Columbus',0,0),(36,'OK','Oklahoma','Oklahoma City',0,0),
(37,'OR','Oregon','Salem',0,1),(38,'PA','Pennsylvania','Harrisburg',0,1),(39,'RI','Rhode Island','Providence',0,0),
(40,'SC','South Carolina','Columbia',0,0),(41,'SD','South Dakota','Pierre',0,0),(42,'TN','Tennessee','Nashville',0,0),
(43,'TX','Texas','Austin',0,0),(44,'UT','Utah','Salt Lake City',0,1),(45,'VT','Vermont','Montpelier',0,0),
(46,'VA','Virginia','Richmond',0,0),(47,'WA','Washington','Olympia',0,0),(48,'WV','West Virginia','Charleston',0,0),
(49,'WI','Wisconsin','Madison',0,0),(50,'WY','Wyoming','Cheyenne',0,0);

-- Territorios (no en refStates prod); inactivos en catálogo Portal, FKs de migración pueden referenciarlos
INSERT INTO ref_state (id_state, state_code, state_name, country_code, is_active) VALUES
(51,'DC','District of Columbia','US',0),(52,'PR','Puerto Rico','US',0),
(53,'VI','Virgin Islands','US',0),(54,'GU','Guam','US',0);

CREATE TABLE ref_attorney (
  id_attorney int NOT NULL COMMENT 'PK estable = prod refAttorneys.idAttorney',
  display_name varchar(255) NOT NULL COMMENT 'Nombre assignable (tblLeads.attorney)',
  firm_name varchar(255) DEFAULT NULL,
  contract_group varchar(255) DEFAULT NULL,
  email_subject_prefix varchar(255) DEFAULT NULL,
  ext_email_targets text,
  internal_source varchar(255) DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Prod status ACTIVE/INACTIVE',
  id_state smallint DEFAULT NULL COMMENT 'FK ref_state — un estado por abogado',
  is_emails_enabled tinyint(1) NOT NULL DEFAULT 1,
  is_emails_ld_enabled tinyint(1) NOT NULL DEFAULT 1,
  is_misc tinyint(1) NOT NULL DEFAULT 0,
  is_standard tinyint(1) NOT NULL DEFAULT 1,
  is_active_on_portal tinyint(1) NOT NULL DEFAULT 1,
  updated_at datetime DEFAULT NULL COMMENT 'Última modificación en prod (row_changed_at)',
  synced_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_attorney),
  KEY idx_attorney_display_name (display_name(100)),
  KEY idx_attorney_is_active (is_active),
  KEY idx_attorney_state (id_state),
  KEY idx_attorney_firm (firm_name(100)),
  CONSTRAINT fk_attorney_state FOREIGN KEY (id_state) REFERENCES ref_state (id_state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Catálogo abogados assignable al lead';

CREATE TABLE ref_tx_location (
  id_tx_location int NOT NULL COMMENT 'PK estable = prod idTXLocation',
  display_name varchar(255) NOT NULL COMMENT 'Prod txLocation — assignable (tblLeads.txLocation)',
  tx_group varchar(255) DEFAULT NULL COMMENT 'Prod txGroup — agrupación operativa',
  location_type_code varchar(100) DEFAULT NULL COMMENT 'Prod locationType AFF/COR/UKN',
  address text,
  int_email_targets text,
  ext_email_targets text,
  is_active tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Prod status ACTIVE/INACTIVE',
  id_state smallint DEFAULT NULL COMMENT 'FK ref_state',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Clínicas / sitios de tratamiento';

CREATE TABLE ref_address_kind (
  id_address_kind tinyint NOT NULL AUTO_INCREMENT,
  kind_code varchar(20) NOT NULL,
  kind_label varchar(80) NOT NULL,
  sort_order tinyint NOT NULL DEFAULT 0,
  PRIMARY KEY (id_address_kind),
  UNIQUE KEY uk_address_kind_code (kind_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Tipo de dirección postal';

INSERT INTO ref_address_kind (id_address_kind, kind_code, kind_label, sort_order) VALUES
(1,'RESIDENCE','Residencia',10),
(2,'MAILING','Correspondencia',20),
(3,'WORK','Trabajo',30),
(4,'OTHER','Otra',99);

CREATE TABLE client_address (
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
  KEY idx_address_created_by (created_by_user_id),
  KEY idx_address_updated_by (updated_by_user_id),
  CONSTRAINT fk_client_address_client FOREIGN KEY (id_client) REFERENCES client (id_client),
  CONSTRAINT fk_client_address_kind FOREIGN KEY (id_address_kind) REFERENCES ref_address_kind (id_address_kind),
  CONSTRAINT fk_client_address_state FOREIGN KEY (id_state) REFERENCES ref_state (id_state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Direcciones del client (N por persona)';

-- Usuarios (persona + HR + oficina). Jerarquía → hierarchy_membership.
CREATE TABLE app_user (
  id_user int NOT NULL,
  legacy_row_id varchar(250) DEFAULT NULL,
  display_name varchar(100) DEFAULT NULL,
  email varchar(100) NOT NULL,
  phone varchar(20) DEFAULT NULL,
  id_job_title int DEFAULT NULL COMMENT 'g_users.title → FK ref_job_title',
  access_level varchar(100) DEFAULT NULL COMMENT 'g_users.systemAccessLevel — rol app legacy',
  id_company_office int DEFAULT NULL COMMENT 'Oficina actual — FK catálogo',
  id_sub_office int DEFAULT NULL COMMENT 'g_users.SubOffice → FK ref_sub_office',
  id_department int DEFAULT NULL COMMENT 'g_users.systemDepartment → FK ref_department',
  id_rank int DEFAULT NULL COMMENT 'g_users.rank → FK ref_rank',
  picture text DEFAULT NULL COMMENT 'g_users.picture',
  hr_ee_type varchar(100) DEFAULT NULL COMMENT 'g_users.hrEeType',
  dob date DEFAULT NULL COMMENT 'g_users.dob',
  hr_deal_amount decimal(12,2) DEFAULT NULL COMMENT 'g_users.hrDealAmount',
  hr_budget decimal(12,2) DEFAULT NULL COMMENT 'g_users.hrBudget',
  boost_budget decimal(12,2) DEFAULT NULL COMMENT 'g_users.boostBudget',
  management_pay decimal(12,2) DEFAULT NULL COMMENT 'g_users.managementPay',
  hr_deal_goal decimal(12,2) DEFAULT NULL COMMENT 'COALESCE(g_users.DealGoal, g_users.hrDealGoal)',
  hr_deal_goal_custom decimal(12,2) DEFAULT NULL COMMENT 'g_users.DealGoalCustom',
  paylocity_id varchar(20) DEFAULT NULL COMMENT 'g_users.paylocityId — payroll / machine output join',
  user_time_zone varchar(255) DEFAULT NULL COMMENT 'Perfil público Glide',
  hr_status varchar(100) DEFAULT NULL COMMENT 'Estado HR actual (g_users.hrStatus)',
  hired_at datetime DEFAULT NULL COMMENT 'Contratación pasada actual — g_users.hrHired',
  termed_at datetime DEFAULT NULL COMMENT 'Baja pasada actual — g_users.hrTermed',
  is_active tinyint(1) NOT NULL DEFAULT 1,
  individual_log_url text DEFAULT NULL COMMENT 'g_users.logsIndividualFile',
  roster_file_url text DEFAULT NULL COMMENT 'g_users.rosterIndividualFile',
  machine_file_url text DEFAULT NULL COMMENT 'g_users.machineIndividual',
  lead_sheet_url text DEFAULT NULL COMMENT 'g_users.leadSheetURL',
  individual_lead_sheet_url text DEFAULT NULL COMMENT 'g_users.individualLeadSheetURL',
  synced_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_user),
  UNIQUE KEY uk_app_user_email (email),
  KEY idx_app_user_company_office (id_company_office),
  KEY idx_app_user_sub_office (id_sub_office),
  KEY idx_app_user_department (id_department),
  KEY idx_app_user_rank (id_rank),
  KEY idx_app_user_job_title (id_job_title),
  KEY idx_app_user_paylocity_id (paylocity_id),
  CONSTRAINT fk_app_user_company_office FOREIGN KEY (id_company_office) REFERENCES ref_company_office (id_company_office),
  CONSTRAINT fk_app_user_sub_office FOREIGN KEY (id_sub_office) REFERENCES ref_sub_office (id_sub_office),
  CONSTRAINT fk_app_user_department FOREIGN KEY (id_department) REFERENCES ref_department (department_id),
  CONSTRAINT fk_app_user_rank FOREIGN KEY (id_rank) REFERENCES ref_rank (rank_id),
  CONSTRAINT fk_app_user_job_title FOREIGN KEY (id_job_title) REFERENCES ref_job_title (job_title_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Persona staff; org operativa en hierarchy_membership';

CREATE TABLE user_channel (
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
  CONSTRAINT fk_user_channel_type FOREIGN KEY (id_channel_type) REFERENCES ref_contact_channel_type (id_channel_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Contactos del staff (N por app_user; catálogo ref_contact_channel_type)';

-- Histórico HR: pasadas cerradas (baja / pasadas anteriores). Vigente activo → app_user.
CREATE TABLE user_hr_period (
  period_id int NOT NULL AUTO_INCREMENT,
  id_user int NOT NULL COMMENT 'Persona (app_user)',
  hr_status varchar(100) DEFAULT NULL COMMENT 'Active, Termed, …',
  hired_at datetime DEFAULT NULL,
  termed_at datetime DEFAULT NULL COMMENT 'Baja de esa pasada',
  stint_order tinyint NOT NULL DEFAULT 1 COMMENT '1 = primera pasada, 2 = reingreso, …',
  is_current_stint tinyint(1) NOT NULL DEFAULT 0,
  synced_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (period_id),
  UNIQUE KEY uk_hr_period_user_stint (id_user, stint_order),
  KEY idx_hr_period_user (id_user),
  KEY idx_hr_period_hr_status (hr_status),
  CONSTRAINT fk_hr_period_user FOREIGN KEY (id_user) REFERENCES app_user (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Pasadas cerradas; vigente activo solo en app_user';

-- Jerarquía operativa: office por id_company_office; pod/team por leader_user_id (sin catálogo)
CREATE TABLE hierarchy_membership (
  membership_id int NOT NULL AUTO_INCREMENT,
  user_id int NOT NULL COMMENT 'app_user.id_user',
  id_hierarchy_level tinyint NOT NULL,
  id_company_office int DEFAULT NULL COMMENT 'Solo nivel OFFICE — FK catálogo',
  leader_user_id int DEFAULT NULL COMMENT 'Jefe en este nivel (pod/team/duo…)',
  is_leader tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = jefe en id_hierarchy_level; 0 = miembro',
  is_primary tinyint(1) NOT NULL DEFAULT 0,
  start_date date DEFAULT NULL,
  end_date date DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  synced_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (membership_id),
  UNIQUE KEY uk_hierarchy_membership (user_id, id_hierarchy_level, id_company_office, leader_user_id, is_leader),
  KEY idx_hm_user (user_id),
  KEY idx_hm_level (id_hierarchy_level),
  KEY idx_hm_company_office (id_company_office),
  KEY idx_hm_leader (leader_user_id),
  KEY idx_hm_is_leader (is_leader),
  CONSTRAINT fk_hm_user FOREIGN KEY (user_id) REFERENCES app_user (id_user),
  CONSTRAINT fk_hm_level FOREIGN KEY (id_hierarchy_level) REFERENCES hierarchy_level (id_hierarchy_level),
  CONSTRAINT fk_hm_company_office FOREIGN KEY (id_company_office) REFERENCES ref_company_office (id_company_office),
  CONSTRAINT fk_hm_leader FOREIGN KEY (leader_user_id) REFERENCES app_user (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Pertenencia jerárquica por ID (office) o por leader (pod/team)';

-- Permisos explícitos adicionales (scope ajeno o temporal). No duplica is_leader implícito.
CREATE TABLE user_access_grant (
  grant_id int NOT NULL AUTO_INCREMENT,
  user_id int NOT NULL COMMENT 'Usuario que recibe el permiso (app_user)',
  id_hierarchy_level tinyint NOT NULL COMMENT 'OFFICE/POD/TEAM/DUO… — FK hierarchy_level',
  id_company_office int DEFAULT NULL COMMENT 'Requerido si level=OFFICE',
  leader_user_id int DEFAULT NULL COMMENT 'Líder del pod/team/duo — requerido si level>=POD',
  access_level enum('VIEW','EDIT','ADMIN') NOT NULL DEFAULT 'VIEW',
  can_export tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Exportar listados/reportes; independiente de ADMIN',
  valid_from datetime DEFAULT NULL,
  valid_to datetime DEFAULT NULL,
  reason varchar(255) DEFAULT NULL,
  granted_by_user_id int DEFAULT NULL,
  updated_by_user_id int DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (grant_id),
  UNIQUE KEY uk_access_grant_scope (user_id, id_hierarchy_level, id_company_office, leader_user_id),
  KEY idx_grant_user (user_id),
  KEY idx_grant_level (id_hierarchy_level),
  KEY idx_grant_office (id_company_office),
  KEY idx_grant_leader (leader_user_id),
  KEY idx_grant_active (is_active, valid_from, valid_to),
  KEY idx_grant_updated_by (updated_by_user_id),
  CONSTRAINT fk_grant_user FOREIGN KEY (user_id) REFERENCES app_user (id_user),
  CONSTRAINT fk_grant_level FOREIGN KEY (id_hierarchy_level) REFERENCES hierarchy_level (id_hierarchy_level),
  CONSTRAINT fk_grant_office FOREIGN KEY (id_company_office) REFERENCES ref_company_office (id_company_office),
  CONSTRAINT fk_grant_leader FOREIGN KEY (leader_user_id) REFERENCES app_user (id_user),
  CONSTRAINT fk_grant_granted_by FOREIGN KEY (granted_by_user_id) REFERENCES app_user (id_user),
  CONSTRAINT fk_grant_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES app_user (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Grants extra: ver/editar scope que no es propio o acceso temporal';

-- Lead (caso intake)
CREATE TABLE `lead` (
  id_lead int NOT NULL AUTO_INCREMENT,
  glide_id int DEFAULT NULL COMMENT 'idLead en Glide/prod — NULL si aún no enlazado (puente cutover)',
  id_lead_status int DEFAULT NULL,
  id_stage tinyint DEFAULT NULL,
  id_company_office int DEFAULT NULL COMMENT 'Oficina del caso — FK catálogo (officeLabel)',
  submitter_user_id int DEFAULT NULL COMMENT 'Quién creó el lead (g_users)',
  referral_source varchar(255) DEFAULT NULL,
  source_type varchar(100) DEFAULT NULL,
  internal_source varchar(255) DEFAULT NULL,
  case_type varchar(100) DEFAULT NULL,
  accident_or_wc varchar(255) DEFAULT NULL,
  is_vip tinyint(1) NOT NULL DEFAULT 0,
  is_hot_lead tinyint(1) NOT NULL DEFAULT 0,
  hot_lead_start_at datetime DEFAULT NULL,
  boost_yn tinyint(1) NOT NULL DEFAULT 0,
  confirmed tinyint(1) NOT NULL DEFAULT 0,
  cnv_value decimal(3,2) DEFAULT NULL,
  callback_id varchar(255) DEFAULT NULL,
  callback_id_new varchar(100) DEFAULT NULL,
  is_callback tinyint(1) NOT NULL DEFAULT 0,
  is_callback_new tinyint(1) NOT NULL DEFAULT 0,
  lead_sort_order varchar(100) DEFAULT NULL,
  new_leads int DEFAULT NULL,
  id_media varchar(255) DEFAULT NULL,
  link_to_lead_record varchar(255) DEFAULT NULL,
  intake_view_stepper varchar(255) DEFAULT NULL,
  id_acc int DEFAULT NULL,
  id_lead_old text,
  employer varchar(50) DEFAULT NULL,
  requested_drop tinyint(1) DEFAULT NULL,
  legacy_lead_id varchar(100) DEFAULT NULL,
  legacy_case_id varchar(100) DEFAULT NULL,
  created_by_user_id int DEFAULT NULL,
  created_at datetime DEFAULT NULL,
  updated_by_user_id int DEFAULT NULL,
  updated_at datetime DEFAULT NULL,
  PRIMARY KEY (id_lead),
  UNIQUE KEY uk_lead_glide_id (glide_id),
  KEY idx_lead_status (id_lead_status),
  KEY idx_lead_company_office (id_company_office),
  KEY idx_lead_submitter (submitter_user_id),
  KEY idx_lead_created (created_at),
  CONSTRAINT fk_lead_status FOREIGN KEY (id_lead_status) REFERENCES refLeadStatus (idLeadStatus),
  CONSTRAINT fk_lead_stage FOREIGN KEY (id_stage) REFERENCES ref_lead_stage (id_stage),
  CONSTRAINT fk_lead_company_office FOREIGN KEY (id_company_office) REFERENCES ref_company_office (id_company_office),
  CONSTRAINT fk_lead_submitter_user FOREIGN KEY (submitter_user_id) REFERENCES app_user (id_user),
  CONSTRAINT fk_lead_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES app_user (id_user),
  CONSTRAINT fk_lead_updated_by_user FOREIGN KEY (updated_by_user_id) REFERENCES app_user (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE lead_accident (
  id_lead int NOT NULL,
  date_of_accident date DEFAULT NULL,
  id_accident_state smallint DEFAULT NULL COMMENT 'FK ref_state — estado del siniestro',
  id_rep_state smallint DEFAULT NULL COMMENT 'FK ref_state — estado del reporte policial',
  id_location_type tinyint DEFAULT NULL COMMENT 'FK ref_accident_location_type — default UNK si vacío',
  id_at_fault_type smallint DEFAULT NULL COMMENT 'FK ref_at_fault_type',
  id_at_fault_sub_type smallint DEFAULT NULL COMMENT 'FK ref_at_fault_type',
  vehicle_description varchar(255) DEFAULT NULL COMMENT 'Prod vehicleModelYear (texto libre, no año numérico)',
  id_property_severity tinyint DEFAULT NULL COMMENT 'FK ref_severity_level',
  id_personal_severity tinyint DEFAULT NULL COMMENT 'FK ref_severity_level',
  police_report tinyint(1) NOT NULL DEFAULT 0,
  driving_rideshare tinyint(1) NOT NULL DEFAULT 0,
  passenger_in_rideshare tinyint(1) NOT NULL DEFAULT 0,
  passenger_count int DEFAULT NULL,
  commercial_policy tinyint(1) NOT NULL DEFAULT 0,
  construction tinyint(1) NOT NULL DEFAULT 0,
  truck tinyint(1) NOT NULL DEFAULT 0,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_user_id int DEFAULT NULL,
  updated_by_user_id int DEFAULT NULL,
  PRIMARY KEY (id_lead),
  KEY idx_lead_accident_state (id_accident_state),
  KEY idx_lead_accident_created_by (created_by_user_id),
  KEY idx_lead_accident_updated_by (updated_by_user_id),
  KEY idx_lead_acc_rep_state (id_rep_state),
  KEY idx_lead_accident_location (id_location_type),
  KEY idx_lead_accident_at_fault (id_at_fault_type),
  KEY idx_lead_accident_property_sev (id_property_severity),
  KEY idx_lead_accident_personal_sev (id_personal_severity),
  CONSTRAINT fk_lead_accident FOREIGN KEY (id_lead) REFERENCES `lead` (id_lead),
  CONSTRAINT fk_lead_accident_state FOREIGN KEY (id_accident_state) REFERENCES ref_state (id_state),
  CONSTRAINT fk_lead_acc_rep_state FOREIGN KEY (id_rep_state) REFERENCES ref_state (id_state),
  CONSTRAINT fk_lead_accident_location FOREIGN KEY (id_location_type) REFERENCES ref_accident_location_type (id_location_type),
  CONSTRAINT fk_lead_accident_at_fault_type FOREIGN KEY (id_at_fault_type) REFERENCES ref_at_fault_type (id_at_fault_type),
  CONSTRAINT fk_lead_accident_at_fault_sub FOREIGN KEY (id_at_fault_sub_type) REFERENCES ref_at_fault_type (id_at_fault_type),
  CONSTRAINT fk_lead_accident_property_sev FOREIGN KEY (id_property_severity) REFERENCES ref_severity_level (id_severity),
  CONSTRAINT fk_lead_accident_personal_sev FOREIGN KEY (id_personal_severity) REFERENCES ref_severity_level (id_severity),
  CONSTRAINT fk_lead_accident_created_by FOREIGN KEY (created_by_user_id) REFERENCES app_user (id_user),
  CONSTRAINT fk_lead_accident_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES app_user (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE lead_legal (
  id_lead int NOT NULL,
  id_attorney int DEFAULT NULL,
  id_legal_status int DEFAULT NULL,
  ticket_attorney tinyint(1) NOT NULL DEFAULT 0,
  has_prev_attorney tinyint(1) NOT NULL DEFAULT 0,
  id_prev_attorney int DEFAULT NULL,
  prev_attorney_name varchar(255) DEFAULT NULL COMMENT 'Fallback si prevAttyName no matchea catálogo',
  is_new_attorney tinyint(1) NOT NULL DEFAULT 0,
  date_legal_accepted datetime DEFAULT NULL,
  date_legal_rejected datetime DEFAULT NULL,
  signing_at datetime DEFAULT NULL,
  date_signed datetime DEFAULT NULL,
  is_docusign tinyint(1) NOT NULL DEFAULT 0,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_user_id int DEFAULT NULL,
  updated_by_user_id int DEFAULT NULL,
  PRIMARY KEY (id_lead),
  KEY idx_lead_legal_attorney (id_attorney),
  KEY idx_lead_legal_prev_attorney (id_prev_attorney),
  KEY idx_lead_legal_created_by (created_by_user_id),
  KEY idx_lead_legal_updated_by (updated_by_user_id),
  CONSTRAINT fk_lead_legal_lead FOREIGN KEY (id_lead) REFERENCES `lead` (id_lead),
  CONSTRAINT fk_lead_legal_attorney FOREIGN KEY (id_attorney) REFERENCES ref_attorney (id_attorney),
  CONSTRAINT fk_lead_legal_prev_attorney FOREIGN KEY (id_prev_attorney) REFERENCES ref_attorney (id_attorney),
  CONSTRAINT fk_lead_legal_status FOREIGN KEY (id_legal_status) REFERENCES refLegalStatus (idLegalStatus),
  CONSTRAINT fk_lead_legal_created_by FOREIGN KEY (created_by_user_id) REFERENCES app_user (id_user),
  CONSTRAINT fk_lead_legal_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES app_user (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE lead_clinical (
  id_lead int NOT NULL,
  id_tx_location int DEFAULT NULL,
  id_clinical_status int DEFAULT NULL,
  is_telemedicine tinyint(1) NOT NULL DEFAULT 0,
  requires_transportation tinyint(1) NOT NULL DEFAULT 0,
  appointment_at datetime DEFAULT NULL,
  visits int DEFAULT NULL,
  idot date DEFAULT NULL,
  ldot date DEFAULT NULL,
  date_clinical_accepted datetime DEFAULT NULL,
  date_clinical_rejected datetime DEFAULT NULL,
  has_um tinyint(1) NOT NULL DEFAULT 0,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_user_id int DEFAULT NULL,
  updated_by_user_id int DEFAULT NULL,
  PRIMARY KEY (id_lead),
  KEY idx_lead_clinical_tx (id_tx_location),
  KEY idx_lead_clinical_created_by (created_by_user_id),
  KEY idx_lead_clinical_updated_by (updated_by_user_id),
  CONSTRAINT fk_lead_clinical_lead FOREIGN KEY (id_lead) REFERENCES `lead` (id_lead),
  CONSTRAINT fk_lead_clinical_tx FOREIGN KEY (id_tx_location) REFERENCES ref_tx_location (id_tx_location),
  CONSTRAINT fk_lead_clinical_status FOREIGN KEY (id_clinical_status) REFERENCES refClinicalStatus (idClinicalStatus),
  CONSTRAINT fk_lead_clinical_created_by FOREIGN KEY (created_by_user_id) REFERENCES app_user (id_user),
  CONSTRAINT fk_lead_clinical_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES app_user (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ref_injury_site (
  id_injury_site smallint NOT NULL AUTO_INCREMENT,
  display_name varchar(100) NOT NULL,
  normalized_name varchar(100) NOT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  portal_sort_order smallint DEFAULT NULL COMMENT 'Orden picklist Edit Lead Portal',
  PRIMARY KEY (id_injury_site),
  UNIQUE KEY uk_injury_site_normalized (normalized_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Sitios/tipos de lesión (picklist intake, ex injuries CSV)';

CREATE TABLE lead_injury (
  id_lead int NOT NULL,
  fracture tinyint(1) NOT NULL DEFAULT 0,
  ambulance tinyint(1) NOT NULL DEFAULT 0,
  hospital tinyint(1) NOT NULL DEFAULT 0,
  hospital_name varchar(255) DEFAULT NULL,
  xray tinyint(1) NOT NULL DEFAULT 0,
  mri tinyint(1) NOT NULL DEFAULT 0,
  ct_scans tinyint(1) NOT NULL DEFAULT 0,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_user_id int DEFAULT NULL,
  updated_by_user_id int DEFAULT NULL,
  PRIMARY KEY (id_lead),
  KEY idx_lead_injury_created_by (created_by_user_id),
  KEY idx_lead_injury_updated_by (updated_by_user_id),
  CONSTRAINT fk_lead_injury FOREIGN KEY (id_lead) REFERENCES `lead` (id_lead),
  CONSTRAINT fk_lead_injury_created_by FOREIGN KEY (created_by_user_id) REFERENCES app_user (id_user),
  CONSTRAINT fk_lead_injury_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES app_user (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE lead_injury_site (
  id_lead int NOT NULL,
  id_injury_site smallint NOT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_user_id int DEFAULT NULL,
  updated_by_user_id int DEFAULT NULL,
  PRIMARY KEY (id_lead, id_injury_site),
  KEY idx_lead_injury_site_site (id_injury_site),
  KEY idx_lead_injury_site_created_by (created_by_user_id),
  KEY idx_lead_injury_site_updated_by (updated_by_user_id),
  CONSTRAINT fk_lead_injury_site_lead FOREIGN KEY (id_lead) REFERENCES `lead` (id_lead),
  CONSTRAINT fk_lead_injury_site_ref FOREIGN KEY (id_injury_site) REFERENCES ref_injury_site (id_injury_site),
  CONSTRAINT fk_lead_injury_site_created_by FOREIGN KEY (created_by_user_id) REFERENCES app_user (id_user),
  CONSTRAINT fk_lead_injury_site_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES app_user (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Lesiones del lesionado principal (N:M ref_injury_site)';

CREATE TABLE lead_timeline (
  id_lead int NOT NULL,
  date_created date DEFAULT NULL,
  date_came_in datetime DEFAULT NULL,
  date_locked_down datetime DEFAULT NULL,
  date_dropped datetime DEFAULT NULL,
  callback_at datetime DEFAULT NULL,
  reason_pending varchar(100) DEFAULT NULL,
  reason_drop varchar(255) DEFAULT NULL,
  other_drop_reason varchar(120) DEFAULT NULL,
  lka_date date DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_lead),
  CONSTRAINT fk_lead_timeline FOREIGN KEY (id_lead) REFERENCES `lead` (id_lead)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Hitos ciclo de vida; quién editó → lead.updated_by_user_id';

-- Histórico de cambios de estado (append-only). Estado vigente sigue en lead / lead_legal / lead_clinical.
CREATE TABLE lead_status_event (
  event_id bigint NOT NULL AUTO_INCREMENT,
  id_lead int NOT NULL,
  status_domain enum('LEAD','LEGAL','CLINICAL','STAGE') NOT NULL,
  id_status_from smallint DEFAULT NULL COMMENT 'FK lógica según domain (refLeadStatus, refLegalStatus, …)',
  id_status_to smallint NOT NULL,
  changed_at datetime NOT NULL,
  changed_by_user_id int DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id),
  KEY idx_lse_lead (id_lead),
  KEY idx_lse_lead_domain (id_lead, status_domain, changed_at),
  KEY idx_lse_changed (changed_at),
  CONSTRAINT fk_lse_lead FOREIGN KEY (id_lead) REFERENCES `lead` (id_lead),
  CONSTRAINT fk_lse_user FOREIGN KEY (changed_by_user_id) REFERENCES app_user (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Transiciones de estado por dominio';

-- Jerarquía org congelada al crear el lead (texto legacy tblLeads + FK oficina catálogo)
CREATE TABLE lead_org_snapshot (
  id_lead int NOT NULL,
  directorate varchar(100) DEFAULT NULL,
  directorate_name varchar(255) DEFAULT NULL,
  directorate_user_id int DEFAULT NULL COMMENT 'app_user.id_user líder directorate al crear',
  region varchar(100) DEFAULT NULL,
  region_name varchar(255) DEFAULT NULL,
  region_user_id int DEFAULT NULL COMMENT 'app_user.id_user líder region al crear',
  office_code varchar(100) DEFAULT NULL COMMENT 'officeLabel — texto legacy',
  id_company_office int DEFAULT NULL COMMENT 'FK catálogo oficina al crear',
  office_name varchar(255) DEFAULT NULL,
  office_legacy varchar(100) DEFAULT NULL COMMENT 'tblLeads.office si difiere de officeLabel',
  office_user_id int DEFAULT NULL COMMENT 'app_user.id_user líder office al crear',
  pod varchar(100) DEFAULT NULL,
  pod_name varchar(255) DEFAULT NULL,
  pod_user_id int DEFAULT NULL COMMENT 'app_user.id_user líder pod al crear',
  team varchar(100) DEFAULT NULL,
  team_name varchar(255) DEFAULT NULL,
  team_user_id int DEFAULT NULL COMMENT 'app_user.id_user líder team al crear',
  duo varchar(100) DEFAULT NULL,
  duo_name varchar(255) DEFAULT NULL,
  duo_user_id int DEFAULT NULL COMMENT 'app_user.id_user líder duo al crear',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_user_id int DEFAULT NULL,
  updated_by_user_id int DEFAULT NULL,
  PRIMARY KEY (id_lead),
  KEY idx_org_snapshot_office (office_code),
  KEY idx_org_snapshot_company_office (id_company_office),
  KEY idx_org_snapshot_team (team),
  KEY idx_org_snapshot_region_user (region_user_id),
  KEY idx_org_snapshot_office_user (office_user_id),
  KEY idx_org_snapshot_pod_user (pod_user_id),
  KEY idx_org_snapshot_team_user (team_user_id),
  KEY idx_org_snapshot_duo_user (duo_user_id),
  KEY idx_org_snapshot_directorate_user (directorate_user_id),
  KEY idx_org_snapshot_created_by (created_by_user_id),
  KEY idx_org_snapshot_updated_by (updated_by_user_id),
  CONSTRAINT fk_lead_org_snapshot FOREIGN KEY (id_lead) REFERENCES `lead` (id_lead),
  CONSTRAINT fk_org_company_office FOREIGN KEY (id_company_office) REFERENCES ref_company_office (id_company_office),
  CONSTRAINT fk_org_snapshot_created_by FOREIGN KEY (created_by_user_id) REFERENCES app_user (id_user),
  CONSTRAINT fk_org_snapshot_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES app_user (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Snapshot org del lead al crear; texto legacy + leader user ids + id_company_office';

CREATE TABLE lead_party (
  id_lead_party int NOT NULL AUTO_INCREMENT,
  id_lead int NOT NULL,
  id_client int NOT NULL,
  id_party_kind tinyint NOT NULL,
  party_sequence tinyint DEFAULT NULL,
  id_tx_location int DEFAULT NULL,
  appointment_at datetime DEFAULT NULL,
  id_personal_severity tinyint DEFAULT NULL COMMENT 'FK ref_severity_level (copasajero)',
  is_primary_party tinyint(1) NOT NULL DEFAULT 0,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_user_id int DEFAULT NULL,
  updated_by_user_id int DEFAULT NULL,
  PRIMARY KEY (id_lead_party),
  UNIQUE KEY uk_lead_client_kind (id_lead, id_client, id_party_kind),
  UNIQUE KEY uk_lead_party_kind_seq (id_lead, id_party_kind, party_sequence),
  KEY idx_lead_party_lead (id_lead),
  KEY idx_lead_party_created_by (created_by_user_id),
  KEY idx_lead_party_updated_by (updated_by_user_id),
  CONSTRAINT fk_lead_party_lead FOREIGN KEY (id_lead) REFERENCES `lead` (id_lead),
  CONSTRAINT fk_lead_party_client FOREIGN KEY (id_client) REFERENCES client (id_client),
  CONSTRAINT fk_lead_party_kind FOREIGN KEY (id_party_kind) REFERENCES party_kind (id_party_kind),
  CONSTRAINT fk_lead_party_tx FOREIGN KEY (id_tx_location) REFERENCES ref_tx_location (id_tx_location),
  CONSTRAINT fk_lead_party_personal_sev FOREIGN KEY (id_personal_severity) REFERENCES ref_severity_level (id_severity),
  CONSTRAINT fk_lead_party_created_by FOREIGN KEY (created_by_user_id) REFERENCES app_user (id_user),
  CONSTRAINT fk_lead_party_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES app_user (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Persona ↔ lead por rol; clínica del copasajero (TX, cita, lesiones vía junction)';

CREATE TABLE lead_party_injury_site (
  id_lead_party int NOT NULL,
  id_injury_site smallint NOT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_user_id int DEFAULT NULL,
  updated_by_user_id int DEFAULT NULL,
  PRIMARY KEY (id_lead_party, id_injury_site),
  KEY idx_party_injury_site_site (id_injury_site),
  KEY idx_party_injury_site_created_by (created_by_user_id),
  KEY idx_party_injury_site_updated_by (updated_by_user_id),
  CONSTRAINT fk_party_injury_site_party FOREIGN KEY (id_lead_party) REFERENCES lead_party (id_lead_party),
  CONSTRAINT fk_party_injury_site_ref FOREIGN KEY (id_injury_site) REFERENCES ref_injury_site (id_injury_site),
  CONSTRAINT fk_party_injury_site_created_by FOREIGN KEY (created_by_user_id) REFERENCES app_user (id_user),
  CONSTRAINT fk_party_injury_site_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES app_user (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Sitios de lesión por copasajero (N:M ref_injury_site)';

CREATE TABLE lead_insurance (
  id_lead_insurance int NOT NULL AUTO_INCREMENT,
  id_lead int NOT NULL,
  id_lead_party int DEFAULT NULL,
  insurance_role enum('PIP','AT_FAULT','PASSENGER') NOT NULL,
  party_sequence tinyint DEFAULT NULL COMMENT '1-5 pasajeros cuando aplica',
  carrier_raw varchar(255) DEFAULT NULL,
  id_carrier int DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_user_id int DEFAULT NULL,
  updated_by_user_id int DEFAULT NULL,
  PRIMARY KEY (id_lead_insurance),
  KEY idx_lead_insurance_lead (id_lead),
  KEY idx_lead_insurance_carrier (id_carrier),
  KEY idx_lead_insurance_party (id_lead_party),
  KEY idx_lead_insurance_created_by (created_by_user_id),
  KEY idx_lead_insurance_updated_by (updated_by_user_id),
  CONSTRAINT fk_lead_insurance_lead FOREIGN KEY (id_lead) REFERENCES `lead` (id_lead),
  CONSTRAINT fk_lead_insurance_party FOREIGN KEY (id_lead_party) REFERENCES lead_party (id_lead_party),
  CONSTRAINT fk_lead_insurance_carrier FOREIGN KEY (id_carrier) REFERENCES ref_insurance_carrier (id_carrier),
  CONSTRAINT fk_lead_insurance_created_by FOREIGN KEY (created_by_user_id) REFERENCES app_user (id_user),
  CONSTRAINT fk_lead_insurance_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES app_user (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Seguros estructurados por rol (catálogo ref_insurance_carrier)';

CREATE TABLE lead_staff (
  id_lead_staff int NOT NULL AUTO_INCREMENT,
  id_lead int NOT NULL,
  id_staff_kind tinyint NOT NULL,
  id_user int DEFAULT NULL,
  staff_key varchar(255) DEFAULT NULL COMMENT 'Email legacy si no hay match en app_user',
  staff_display_name varchar(255) DEFAULT NULL,
  assigned_at datetime DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_user_id int DEFAULT NULL,
  updated_by_user_id int DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_lead_staff),
  KEY idx_lead_staff_lead (id_lead),
  KEY idx_lead_staff_user (id_user),
  KEY idx_lead_staff_created_by (created_by_user_id),
  KEY idx_lead_staff_updated_by (updated_by_user_id),
  CONSTRAINT fk_lead_staff_lead FOREIGN KEY (id_lead) REFERENCES `lead` (id_lead),
  CONSTRAINT fk_lead_staff_kind FOREIGN KEY (id_staff_kind) REFERENCES staff_kind (id_staff_kind),
  CONSTRAINT fk_lead_staff_user FOREIGN KEY (id_user) REFERENCES app_user (id_user),
  CONSTRAINT fk_lead_staff_created_by FOREIGN KEY (created_by_user_id) REFERENCES app_user (id_user),
  CONSTRAINT fk_lead_staff_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES app_user (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE lead_sync_flag (
  id_sync_flag int NOT NULL AUTO_INCREMENT,
  id_lead int NOT NULL,
  flag_code varchar(50) NOT NULL,
  flag_value varchar(50) DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_user_id int DEFAULT NULL,
  updated_by_user_id int DEFAULT NULL,
  PRIMARY KEY (id_sync_flag),
  UNIQUE KEY uk_lead_sync_flag (id_lead, flag_code),
  KEY idx_sync_flag_created_by (created_by_user_id),
  KEY idx_sync_flag_updated_by (updated_by_user_id),
  CONSTRAINT fk_sync_flag_lead FOREIGN KEY (id_lead) REFERENCES `lead` (id_lead),
  CONSTRAINT fk_sync_flag_created_by FOREIGN KEY (created_by_user_id) REFERENCES app_user (id_user),
  CONSTRAINT fk_sync_flag_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES app_user (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE lead_note (
  id_note int NOT NULL AUTO_INCREMENT,
  id_lead int NOT NULL,
  note_type enum('intake','accident','hospital','comment') NOT NULL,
  body text NOT NULL,
  document_id varchar(512) DEFAULT NULL,
  source varchar(128) DEFAULT NULL,
  mentions json DEFAULT NULL COMMENT '@user ids (chat comment)',
  recipient_user_ids json DEFAULT NULL COMMENT 'notification recipients (chat comment)',
  posted_at datetime(3) NOT NULL,
  updated_at datetime(3) DEFAULT NULL,
  posted_by varchar(255) DEFAULT NULL,
  posted_by_user_id int DEFAULT NULL,
  PRIMARY KEY (id_note),
  KEY idx_note_lead (id_lead, posted_at),
  KEY idx_note_type (note_type),
  CONSTRAINT fk_note_lead FOREIGN KEY (id_lead) REFERENCES `lead` (id_lead),
  CONSTRAINT fk_note_posted_by FOREIGN KEY (posted_by_user_id) REFERENCES app_user (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 AUTO_INCREMENT=4000000
  COMMENT='Notas: snapshots tblLeads (intake/accident/hospital) + hilo tblLeadComments (comment)';

CREATE TABLE entity_log (
  id_log bigint unsigned NOT NULL AUTO_INCREMENT,
  entity_table varchar(64) NOT NULL,
  entity_pk varchar(64) NOT NULL,
  line_count smallint unsigned NOT NULL DEFAULT 0,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id_log),
  UNIQUE KEY uk_entity_log_record (entity_table, entity_pk),
  KEY idx_entity_log_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Cabecera de log por registro (1 por fila transaccional)';

CREATE TABLE log_detail (
  id_log_detail bigint unsigned NOT NULL AUTO_INCREMENT,
  id_log bigint unsigned NOT NULL,
  occurred_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  operation char(1) NOT NULL COMMENT 'I U D',
  module_name varchar(40) DEFAULT NULL,
  transaction_name varchar(60) DEFAULT NULL,
  notes varchar(500) DEFAULT NULL,
  id_actor_user int DEFAULT NULL,
  id_actor_persona int DEFAULT NULL,
  actor_ip varchar(45) DEFAULT NULL,
  actor_host varchar(60) DEFAULT NULL,
  before_json json DEFAULT NULL,
  after_json json DEFAULT NULL,
  PRIMARY KEY (id_log_detail),
  KEY idx_log_detail_log (id_log, occurred_at),
  KEY idx_log_detail_occurred (occurred_at),
  KEY idx_log_detail_actor (id_actor_user),
  CONSTRAINT fk_log_detail_log FOREIGN KEY (id_log) REFERENCES entity_log (id_log),
  CONSTRAINT fk_log_detail_actor_user FOREIGN KEY (id_actor_user) REFERENCES app_user (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Detalle append-only por operación';

CREATE TABLE import_reject (
  id_reject int NOT NULL AUTO_INCREMENT,
  id_lead int NOT NULL,
  field_name varchar(100) NOT NULL,
  raw_value varchar(500) DEFAULT NULL,
  reject_reason varchar(255) DEFAULT NULL,
  rejected_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_reject),
  KEY idx_reject_lead (id_lead),
  KEY idx_reject_field (field_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

ALTER TABLE client
  ADD CONSTRAINT fk_client_created_by FOREIGN KEY (created_by_user_id) REFERENCES app_user (id_user),
  ADD CONSTRAINT fk_client_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES app_user (id_user),
  ADD CONSTRAINT fk_client_linked_user FOREIGN KEY (id_linked_user) REFERENCES app_user (id_user);

ALTER TABLE client_channel
  ADD CONSTRAINT fk_channel_created_by FOREIGN KEY (created_by_user_id) REFERENCES app_user (id_user),
  ADD CONSTRAINT fk_channel_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES app_user (id_user);

ALTER TABLE client_address
  ADD CONSTRAINT fk_address_created_by FOREIGN KEY (created_by_user_id) REFERENCES app_user (id_user),
  ADD CONSTRAINT fk_address_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES app_user (id_user);

ALTER TABLE user_channel
  ADD CONSTRAINT fk_user_channel_created_by FOREIGN KEY (created_by_user_id) REFERENCES app_user (id_user),
  ADD CONSTRAINT fk_user_channel_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES app_user (id_user);

INSERT IGNORE INTO refLeadStatus (idLeadStatus, leadStatus, icon, leadOrder, portal_tab_scope, portal_edit_action_label, portal_edit_action_order) VALUES
(1,'New Lead',NULL,1,'both',NULL,NULL),
(2,'Call Back',NULL,4,'hidden',NULL,NULL),
(3,'No Show',NULL,2,'hidden',NULL,NULL),
(4,'CNA',NULL,3,'both','CNA',3),
(5,'Pending',NULL,7,'both','Pending',1),
(6,'Rescheduled',NULL,6,'hidden',NULL,NULL),
(7,'Problem',NULL,9,'hidden',NULL,NULL),
(8,'Locked Down',NULL,5,'both',NULL,NULL),
(9,'Came In',NULL,8,'case_manager',NULL,NULL),
(10,'Dropped',NULL,91,'case_manager','Drop',2),
(11,'Rescheduled',NULL,NULL,'hidden',NULL,NULL),
(12,'Came in - unverified',NULL,NULL,'hidden',NULL,NULL);

INSERT IGNORE INTO refClinicalStatus (idClinicalStatus, icon, clinicalStatus) VALUES
(1,'','Pending'),(2,'','Scheduled'),(3,'','Treating'),(4,'','Paused'),(5,'','Problem'),
(6,'','Risk99'),(7,'','Bad Case!'),(8,'','Finalized'),(9,'','Referred Out'),(10,'','Dropped'),(11,NULL,'No Show');

INSERT IGNORE INTO refLegalStatus (idLegalStatus, legalStatus, icon) VALUES
(1,'Pending',''),(2,'Scheduled',''),(3,'Finalized',''),(4,'Settled',''),(5,'Dropped',''),
(6,'No Case',NULL),(7,'Signed',NULL),(8,'No Show',NULL);

INSERT IGNORE INTO ref_lead_stage (id_stage, stage_code, stage_label, sort_order) VALUES
(1,'Prospect','Prospect',1),(2,'Owned','Owned',2);

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

INSERT IGNORE INTO party_kind (id_party_kind, kind_code, kind_label, display_order) VALUES
(1,'INJURED','Injured party',1),
(2,'CO_PASSENGER','Co-passenger',2),
(3,'DRIVER','Driver',3),
(4,'MINOR','Minor',4),
(5,'WITNESS','Witness',5);

INSERT IGNORE INTO hierarchy_level (id_hierarchy_level, level_code, level_label, level_rank) VALUES
(1,'DIRECTORATE','Directorate',1),
(2,'REGION','Region',2),
(3,'OFFICE','Office',3),
(4,'POD','Pod',4),
(5,'TEAM','Team',5),
(6,'DUO','Duo',6);

INSERT IGNORE INTO staff_kind (id_staff_kind, kind_code, kind_label) VALUES
(1,'SUBMITTER','Submitter'),
(2,'INTAKE','Intake specialist'),
(3,'CREATOR','Creator'),
(4,'UPDATER','Updater'),
(5,'MANAGER','Manager'),
(6,'AUDITOR','Auditor');
