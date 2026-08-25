-- Poblar id_*_dim en reglas lookup (correr después del seed de prod).
SET NAMES utf8mb4;

UPDATE ref_log_status_rule SET id_tx_dim = 1 WHERE tx_location_alias = 'COR/AFF' AND (id_tx_dim IS NULL OR id_tx_dim = 0);
UPDATE ref_log_status_rule SET id_tx_dim = 2 WHERE tx_location_alias = 'REF OUT' AND (id_tx_dim IS NULL OR id_tx_dim = 0);
UPDATE ref_log_status_rule SET id_tx_dim = 3 WHERE tx_location_alias = 'Workers Comp' AND (id_tx_dim IS NULL OR id_tx_dim = 0);
UPDATE ref_log_status_rule SET id_visits_dim = 4 WHERE visits_alias = '<12V' AND (id_visits_dim IS NULL OR id_visits_dim = 0);
UPDATE ref_log_status_rule SET id_visits_dim = 5 WHERE visits_alias = '>=12V' AND (id_visits_dim IS NULL OR id_visits_dim = 0);
UPDATE ref_log_status_rule SET id_visits_dim = 6 WHERE visits_alias = 'N/A' AND (id_visits_dim IS NULL OR id_visits_dim = 0);
UPDATE ref_log_status_rule SET id_ldot_dim = 7 WHERE ldot_alias = '<30D' AND (id_ldot_dim IS NULL OR id_ldot_dim = 0);
UPDATE ref_log_status_rule SET id_ldot_dim = 8 WHERE ldot_alias = '>30D' AND (id_ldot_dim IS NULL OR id_ldot_dim = 0);
UPDATE ref_log_status_rule SET id_ldot_dim = 9 WHERE ldot_alias = '>60D' AND (id_ldot_dim IS NULL OR id_ldot_dim = 0);
UPDATE ref_log_status_rule SET id_accident_dim = 10 WHERE accident_state_alias = 'PIP STATE' AND (id_accident_dim IS NULL OR id_accident_dim = 0);
UPDATE ref_log_status_rule SET id_accident_dim = 11 WHERE accident_state_alias = 'NON PIP STATE' AND (id_accident_dim IS NULL OR id_accident_dim = 0);
UPDATE ref_log_status_rule SET id_legal_dim = 12 WHERE legal_status_alias = 'CONFIRMED' AND (id_legal_dim IS NULL OR id_legal_dim = 0);
UPDATE ref_log_status_rule SET id_legal_dim = 13 WHERE legal_status_alias = 'NO CASE' AND (id_legal_dim IS NULL OR id_legal_dim = 0);
UPDATE ref_log_status_rule SET id_legal_dim = 14 WHERE legal_status_alias = 'SIGNED' AND (id_legal_dim IS NULL OR id_legal_dim = 0);
UPDATE ref_log_status_rule SET id_clinical_dim = 15 WHERE clinical_status_alias = 'ACTIVE' AND (id_clinical_dim IS NULL OR id_clinical_dim = 0);
UPDATE ref_log_status_rule SET id_clinical_dim = 16 WHERE clinical_status_alias = 'DROPPED' AND (id_clinical_dim IS NULL OR id_clinical_dim = 0);
UPDATE ref_log_status_rule SET id_clinical_dim = 17 WHERE clinical_status_alias = '#N/A' AND (id_clinical_dim IS NULL OR id_clinical_dim = 0);
