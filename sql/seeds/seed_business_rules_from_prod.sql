-- Seed business rules from dbProduction
-- npm run seed:export-business-rules
SET NAMES utf8mb4;

INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '<30D', 'NON PIP STATE', 'CONFIRMED', 'ACTIVE', 1, 1, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '<30D', 'NON PIP STATE', 'NO CASE', 'ACTIVE', 2, 2, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '<30D', 'NON PIP STATE', 'SIGNED', 'ACTIVE', 1, 3, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '<30D', 'NON PIP STATE', 'CONFIRMED', 'DROPPED', 1, 4, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '<30D', 'NON PIP STATE', 'NO CASE', 'DROPPED', 2, 5, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '<30D', 'NON PIP STATE', 'SIGNED', 'DROPPED', 1, 6, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '<30D', 'PIP STATE', 'CONFIRMED', 'ACTIVE', 1, 7, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '<30D', 'PIP STATE', 'CONFIRMED', 'DROPPED', 2, 8, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '<30D', 'PIP STATE', 'CONFIRMED', '#N/A', 1, 9, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '<30D', 'PIP STATE', 'NO CASE', 'ACTIVE', 1, 10, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '<30D', 'PIP STATE', 'NO CASE', 'DROPPED', 2, 11, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '<30D', 'PIP STATE', 'SIGNED', 'ACTIVE', 1, 12, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '<30D', 'PIP STATE', 'SIGNED', 'DROPPED', 2, 13, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '<30D', 'PIP STATE', 'SIGNED', '#N/A', 1, 14, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>30D', 'NON PIP STATE', 'CONFIRMED', 'ACTIVE', 1, 15, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>30D', 'NON PIP STATE', 'CONFIRMED', 'DROPPED', 1, 16, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>30D', 'NON PIP STATE', 'CONFIRMED', '#N/A', 1, 17, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>30D', 'NON PIP STATE', 'NO CASE', 'ACTIVE', 2, 18, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>30D', 'NON PIP STATE', 'NO CASE', 'DROPPED', 2, 19, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>30D', 'NON PIP STATE', 'NO CASE', '#N/A', 2, 20, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>30D', 'NON PIP STATE', 'SIGNED', 'ACTIVE', 1, 21, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>30D', 'NON PIP STATE', 'SIGNED', 'DROPPED', 1, 22, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>30D', 'PIP STATE', 'CONFIRMED', 'ACTIVE', 1, 23, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>30D', 'PIP STATE', 'CONFIRMED', 'DROPPED', 2, 24, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>30D', 'PIP STATE', 'CONFIRMED', '#N/A', 1, 25, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>30D', 'PIP STATE', 'NO CASE', 'ACTIVE', 2, 26, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>30D', 'PIP STATE', 'NO CASE', 'DROPPED', 2, 27, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>30D', 'PIP STATE', 'NO CASE', '#N/A', 2, 28, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>30D', 'PIP STATE', 'SIGNED', 'ACTIVE', 1, 29, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>30D', 'PIP STATE', 'SIGNED', 'DROPPED', 2, 30, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>30D', 'PIP STATE', 'SIGNED', '#N/A', 2, 31, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '<30D', 'NON PIP STATE', 'CONFIRMED', 'ACTIVE', 1, 32, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '<30D', 'NON PIP STATE', 'NO CASE', 'ACTIVE', 1, 33, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '<30D', 'PIP STATE', 'CONFIRMED', 'ACTIVE', 1, 34, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '<30D', 'PIP STATE', 'CONFIRMED', 'DROPPED', 1, 35, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '<30D', 'PIP STATE', 'NO CASE', 'ACTIVE', 1, 36, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '<30D', 'PIP STATE', 'NO CASE', 'DROPPED', 1, 37, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '<30D', 'PIP STATE', 'SIGNED', 'ACTIVE', 1, 38, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '<30D', 'PIP STATE', 'SIGNED', 'DROPPED', 1, 39, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '>30D', 'NON PIP STATE', 'CONFIRMED', 'ACTIVE', 1, 40, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '>30D', 'NON PIP STATE', 'CONFIRMED', 'DROPPED', 1, 41, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '>30D', 'NON PIP STATE', 'NO CASE', 'ACTIVE', 1, 42, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '>30D', 'NON PIP STATE', 'NO CASE', 'DROPPED', 1, 43, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '>30D', 'NON PIP STATE', 'SIGNED', 'ACTIVE', 1, 44, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '>30D', 'NON PIP STATE', 'SIGNED', 'DROPPED', 1, 45, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '>30D', 'PIP STATE', 'CONFIRMED', 'ACTIVE', 1, 46, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '>30D', 'PIP STATE', 'CONFIRMED', 'DROPPED', 1, 47, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '>30D', 'PIP STATE', 'CONFIRMED', '#N/A', 1, 48, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '>30D', 'PIP STATE', 'NO CASE', 'ACTIVE', 1, 49, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '>30D', 'PIP STATE', 'NO CASE', 'DROPPED', 1, 50, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '>30D', 'PIP STATE', 'SIGNED', 'ACTIVE', 1, 51, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '>30D', 'PIP STATE', 'SIGNED', 'DROPPED', 1, 52, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '>30D', 'PIP STATE', 'SIGNED', '#N/A', 1, 53, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'REF OUT', 'N/A', '<30D', 'NON PIP STATE', 'CONFIRMED', '#N/A', 3, 54, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'REF OUT', 'N/A', '<30D', 'NON PIP STATE', 'NO CASE', '#N/A', 2, 55, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'REF OUT', 'N/A', '<30D', 'NON PIP STATE', 'SIGNED', '#N/A', 3, 56, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'REF OUT', 'N/A', '<30D', 'PIP STATE', 'CONFIRMED', '#N/A', 3, 57, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'REF OUT', 'N/A', '<30D', 'PIP STATE', 'NO CASE', '#N/A', 2, 58, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'REF OUT', 'N/A', '<30D', 'PIP STATE', 'SIGNED', '#N/A', 3, 59, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'REF OUT', 'N/A', '>30D', 'NON PIP STATE', 'CONFIRMED', '#N/A', 3, 60, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'REF OUT', 'N/A', '>30D', 'NON PIP STATE', 'NO CASE', '#N/A', 2, 61, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'REF OUT', 'N/A', '>30D', 'NON PIP STATE', 'SIGNED', '#N/A', 3, 62, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'REF OUT', 'N/A', '>30D', 'PIP STATE', 'CONFIRMED', '#N/A', 3, 63, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'REF OUT', 'N/A', '>30D', 'PIP STATE', 'NO CASE', '#N/A', 2, 64, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'REF OUT', 'N/A', '>30D', 'PIP STATE', 'SIGNED', '#N/A', 3, 65, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'Workers Comp', 'N/A', '<30D', 'NON PIP STATE', 'SIGNED', '#N/A', 3, 66, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'Workers Comp', 'N/A', '<30D', 'PIP STATE', 'CONFIRMED', '#N/A', 3, 67, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'Workers Comp', 'N/A', '<30D', 'PIP STATE', 'NO CASE', '#N/A', 2, 68, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'Workers Comp', 'N/A', '<30D', 'PIP STATE', 'SIGNED', '#N/A', 3, 69, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'Workers Comp', 'N/A', '>30D', 'NON PIP STATE', 'CONFIRMED', '#N/A', 3, 70, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'Workers Comp', 'N/A', '>30D', 'NON PIP STATE', 'NO CASE', '#N/A', 2, 71, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'Workers Comp', 'N/A', '>30D', 'NON PIP STATE', 'SIGNED', '#N/A', 3, 72, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'Workers Comp', 'N/A', '>30D', 'PIP STATE', 'CONFIRMED', '#N/A', 3, 73, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'Workers Comp', 'N/A', '>30D', 'PIP STATE', 'NO CASE', '#N/A', 2, 74, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'Workers Comp', 'N/A', '>30D', 'PIP STATE', 'SIGNED', '#N/A', 3, 75, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '<30D', 'NON PIP STATE', 'CONFIRMED', 'DROPPED', 1, 76, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '<30D', 'NON PIP STATE', 'NO CASE', 'DROPPED', 1, 77, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '<30D', 'NON PIP STATE', 'SIGNED', 'ACTIVE', 1, 78, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '>=12V', '<30D', 'NON PIP STATE', 'SIGNED', 'DROPPED', 1, 79, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', 'N/A', '<30D', 'NON PIP STATE', 'CONFIRMED', '#N/A', 1, 80, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', 'N/A', '<30D', 'NON PIP STATE', 'NO CASE', '#N/A', 2, 81, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', 'N/A', '<30D', 'NON PIP STATE', 'SIGNED', '#N/A', 1, 82, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', 'N/A', '<30D', 'PIP STATE', 'CONFIRMED', '#N/A', 1, 83, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', 'N/A', '<30D', 'PIP STATE', 'NO CASE', '#N/A', 2, 84, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', 'N/A', '<30D', 'PIP STATE', 'SIGNED', '#N/A', 1, 85, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', 'N/A', '>30D', 'NON PIP STATE', 'CONFIRMED', '#N/A', 1, 86, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', 'N/A', '>30D', 'NON PIP STATE', 'NO CASE', '#N/A', 2, 87, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', 'N/A', '>30D', 'NON PIP STATE', 'SIGNED', '#N/A', 1, 88, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', 'N/A', '>30D', 'PIP STATE', 'CONFIRMED', '#N/A', 1, 89, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', 'N/A', '>30D', 'PIP STATE', 'NO CASE', '#N/A', 2, 90, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', 'N/A', '>30D', 'PIP STATE', 'SIGNED', '#N/A', 1, 91, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>30D', 'NON PIP STATE', 'SIGNED', '#N/A', 1, 92, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>60D', 'NON PIP STATE', 'CONFIRMED', 'ACTIVE', 2, 93, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>60D', 'NON PIP STATE', 'CONFIRMED', 'DROPPED', 2, 94, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>60D', 'NON PIP STATE', 'CONFIRMED', '#N/A', 2, 95, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>60D', 'NON PIP STATE', 'NO CASE', 'ACTIVE', 2, 96, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>60D', 'NON PIP STATE', 'NO CASE', 'DROPPED', 2, 97, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>60D', 'NON PIP STATE', 'NO CASE', '#N/A', 2, 98, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>60D', 'NON PIP STATE', 'SIGNED', 'ACTIVE', 2, 99, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>60D', 'NON PIP STATE', 'SIGNED', 'DROPPED', 2, 100, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>60D', 'NON PIP STATE', 'SIGNED', '#N/A', 2, 101, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>60D', 'PIP STATE', 'CONFIRMED', 'ACTIVE', 2, 102, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>60D', 'PIP STATE', 'CONFIRMED', 'DROPPED', 2, 103, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>60D', 'PIP STATE', 'CONFIRMED', '#N/A', 2, 104, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>60D', 'PIP STATE', 'NO CASE', 'ACTIVE', 2, 105, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>60D', 'PIP STATE', 'NO CASE', 'DROPPED', 2, 106, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>60D', 'PIP STATE', 'NO CASE', '#N/A', 2, 107, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>60D', 'PIP STATE', 'SIGNED', 'ACTIVE', 2, 108, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>60D', 'PIP STATE', 'SIGNED', 'DROPPED', 2, 109, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '>60D', 'PIP STATE', 'SIGNED', '#N/A', 2, 110, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'Workers Comp', 'N/A', '<30D', 'NON PIP STATE', 'CONFIRMED', '#N/A', 3, 111, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'Workers Comp', 'N/A', '<30D', 'NON PIP STATE', 'NO CASE', '#N/A', 2, 112, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '<30D', 'PIP STATE', 'NO CASE', '#N/A', 2, 113, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '<30D', 'NON PIP STATE', 'CONFIRMED', '#N/A', 1, 114, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '<30D', 'NON PIP STATE', 'NO CASE', '#N/A', 2, 115, 1);
INSERT IGNORE INTO ref_log_status_rule (
  tag, tx_location_alias, visits_alias, ldot_alias, accident_state_alias,
  legal_status_alias, clinical_status_alias, id_log_status, legacy_rule_id, is_active
) VALUES (NULL, 'COR/AFF', '<12V', '<30D', 'NON PIP STATE', 'SIGNED', '#N/A', 1, 116, 1);

INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'confirmed', 'confirmed', 1);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - ins no um/bi', 'no case - ins no um/bi', 2);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - client termed', 'no case - client termed', 3);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'signed', 'signed', 4);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - client insufficient coverage', 'no case - client insufficient coverage', 5);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - client at fault', 'no case - client at fault', 6);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - ins denied liability', 'no case - ins denied liability', 7);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case', 'no case', 8);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - client has representation', 'no case - client has representation', 9);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - client not interested', 'no case - client not interested', 10);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - atty termed', 'no case - atty termed', 11);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - client unresponsive', 'no case - client unresponsive', 12);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - gap in treatment/non compliant', 'no case - gap in treatment/non compliant', 13);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - other', 'no case - other', 14);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - client never signed', 'no case - client never signed', 15);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - duplicate', 'no case - duplicate', 16);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - client gap in treatment', 'no case - client gap in treatment', 17);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - client non compliant', 'no case - client non compliant', 18);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - client is minor', 'no case - client is minor', 19);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - admin error', 'no case - admin error', 20);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - rr review', 'no case - rr review', 21);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - client no pain', 'no case - client no pain', 22);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - not in rr system', 'no case - not in rr system', 23);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - low limits', 'no case - low limits', 24);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', '#N/A', '#N/A', 25);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'ref out', 'ref out', 26);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case- no insurance coverage', 'no case- no insurance coverage', 27);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case- no insurance', 'no case- no insurance', 28);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - ins low limits', 'no case - ins low limits', 29);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - client no reason given', 'no case - client no reason given', 30);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'duplicate', 'duplicate', 31);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'active', 'active', 32);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - conflict', 'no case - conflict', 33);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'not signed', 'not signed', 34);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - atty rejected', 'no case - atty rejected', 35);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - invalid insurance', 'no case - invalid insurance', 36);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'dropped', 'dropped', 37);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'nonstandard', 'nonstandard', 38);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'doctor only', 'doctor only', 39);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - questionable liability', 'no case - questionable liability', 40);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'non-standard', 'non-standard', 41);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'pending', 'pending', 42);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('legal', 'no case - no pain', 'no case - no pain', 43);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('clinical', 'active', 'active', 44);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('clinical', 'dropped', 'dropped', 45);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('clinical', 'finalized', 'finalized', 46);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('clinical', 'inactive', 'inactive', 47);
INSERT IGNORE INTO ref_status_catalog (
  status_domain, value_normalized, description, legacy_catalog_id
) VALUES ('clinical', 'no show', 'no show', 48);

INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Alabama' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Alaska' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Arizona' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Arkansas' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'California' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Colorado' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Connecticut' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Delaware' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Florida' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Georgia' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Hawaii' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Idaho' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Illinois' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Indiana' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Iowa' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Kansas' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 0.50, 1 FROM ref_state WHERE state_name = 'Kentucky' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Louisiana' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 0.33, 1 FROM ref_state WHERE state_name = 'Maine' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 0.33, 1 FROM ref_state WHERE state_name = 'Maryland' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Massachusetts' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Michigan' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Minnesota' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Mississippi' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Missouri' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Montana' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Nebraska' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 0.50, 1 FROM ref_state WHERE state_name = 'Nevada' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'New Hampshire' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'New Jersey' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 0.33, 1 FROM ref_state WHERE state_name = 'New Mexico' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'New York' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'North Carolina' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'North Dakota' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 0.50, 1 FROM ref_state WHERE state_name = 'Ohio' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Oklahoma' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 0.50, 1 FROM ref_state WHERE state_name = 'Oregon' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Pennsylvania' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Rhode Island' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'South Carolina' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'South Dakota' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Tennessee' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Texas' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 0.50, 1 FROM ref_state WHERE state_name = 'Utah' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Vermont' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 0.33, 1 FROM ref_state WHERE state_name = 'Virginia' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 0.50, 1 FROM ref_state WHERE state_name = 'Washington' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'West Virginia' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Wisconsin' LIMIT 1;
INSERT IGNORE INTO ref_state_cnv (id_state, cnv_value, is_active)
SELECT id_state, 1.00, 1 FROM ref_state WHERE state_name = 'Wyoming' LIMIT 1;
