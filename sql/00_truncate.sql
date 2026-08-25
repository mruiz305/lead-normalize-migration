-- Vacía datos operativos. Conserva catálogos ref* y hierarchy_membership.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE import_reject;
TRUNCATE TABLE lead_status_event;
TRUNCATE TABLE lead_note;
TRUNCATE TABLE lead_sync_flag;
TRUNCATE TABLE lead_staff;
TRUNCATE TABLE lead_insurance;
TRUNCATE TABLE lead_party_injury_site;
TRUNCATE TABLE lead_party;
TRUNCATE TABLE lead_org_snapshot;
TRUNCATE TABLE lead_timeline;
TRUNCATE TABLE lead_injury_site;
TRUNCATE TABLE lead_injury;
TRUNCATE TABLE lead_clinical;
TRUNCATE TABLE lead_legal;
TRUNCATE TABLE lead_accident;
TRUNCATE TABLE client_address;
TRUNCATE TABLE client_channel;
TRUNCATE TABLE client;
TRUNCATE TABLE `lead`;

SET FOREIGN_KEY_CHECKS = 1;
