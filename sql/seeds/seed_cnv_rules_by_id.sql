-- Reglas CNV por IDs de catálogo (reemplaza condiciones por texto).
-- ref_log_status: 1=ACTIVE, 2=DROPPED, 3=REF OUT
-- ref_log_rule_dimension legal: 12=CONFIRMED, 13=NO CASE | clinical: 15=ACTIVE, 16=DROPPED | tx: 1=COR/AFF, 3=WC
-- ref_state: FL=9, NY=32
SET NAMES utf8mb4;

SET @barry_id := (SELECT id_attorney FROM ref_attorney WHERE UPPER(display_name) = 'BARRY LAW GROUP' LIMIT 1);
SET @shulman_id := (SELECT id_attorney FROM ref_attorney WHERE display_name = 'Shulman & Hill Lawfirm (MVA)' LIMIT 1);
SET @no_case_at_fault := (SELECT idLegalStatus FROM refLegalStatus WHERE legalStatus = 'NO CASE - CLIENT AT FAULT' LIMIT 1);

DELETE FROM ref_cnv_rule WHERE rule_code LIKE 'cnv_%';

INSERT INTO ref_cnv_rule (rule_code, description, priority, cnv_value, condition_json) VALUES
('cnv_no_case_clinical_dropped', 'NO CASE + Clinical DROPPED + visits<12', 200, 0.00,
  JSON_OBJECT('id_legal_dim', 13, 'id_clinical_dim', 16, 'visits_lt', 12)),
('cnv_no_case_clinical_inactive', 'NO CASE + clínico inactivo + visits<12', 210, 0.00,
  JSON_OBJECT('id_legal_dim', 13, 'id_clinical_dim_not_in', JSON_ARRAY(15), 'visits_lt', 12)),
('cnv_no_case_lop', 'NO CASE + caseType LOP', 220, 0.00,
  JSON_OBJECT('id_legal_dim', 13, 'case_type', 'LOP')),
('cnv_workers_comp', 'Workers Comp txLocation', 300, 0.33,
  JSON_OBJECT('id_legal_dim_not_in', JSON_ARRAY(13), 'id_tx_dim', 3)),
('cnv_barry_misc_active', 'Barry Law Group misc + log ACTIVE/REF OUT', 310, 0.33,
  JSON_OBJECT('attorney_is_misc', true, 'id_attorney', @barry_id, 'id_log_status_in', JSON_ARRAY(1, 3))),

('cnv_special_active', 'SpecialList ACTIVE (no Barry)', 700, 1.00,
  JSON_OBJECT('special_active', true, 'id_attorney_not', @barry_id)),
('cnv_special_active_barry', 'SpecialList ACTIVE + Barry', 710, 0.33,
  JSON_OBJECT('special_active', true, 'id_attorney', @barry_id)),

('cnv_fl_cor_feb_apr_15', 'Florida COR Feb-Abr 2026 → 1.5', 801, 1.50,
  JSON_OBJECT('id_tx_dim', 1, 'date_came_in_from', '2026-02-11', 'date_came_in_to', '2026-04-30', 'id_accident_state', 9, 'attorney_is_standard', true, 'id_legal_dim_not_in', JSON_ARRAY(13))),
('cnv_fl_cor_feb_apr_no_case', 'Florida COR Feb-Abr NO CASE genérico → 1', 802, 1.00,
  JSON_OBJECT('id_tx_dim', 1, 'date_came_in_from', '2026-02-11', 'date_came_in_to', '2026-04-30', 'id_accident_state', 9, 'attorney_is_standard', true, 'id_legal_dim', 13, 'id_legal_status_not_in', JSON_ARRAY(@no_case_at_fault))),
('cnv_fl_cor_feb_apr_at_fault', 'Florida COR Feb-Abr NO CASE CLIENT AT FAULT → 0.33', 803, 0.33,
  JSON_OBJECT('id_tx_dim', 1, 'date_came_in_from', '2026-02-11', 'date_came_in_to', '2026-04-30', 'id_accident_state', 9, 'attorney_is_standard', true, 'id_legal_status', @no_case_at_fault)),

('cnv_fl_cor_may_dec_15', 'Florida COR May-Dic 2026 → 1.5', 811, 1.50,
  JSON_OBJECT('id_tx_dim', 1, 'date_came_in_from', '2026-05-01', 'date_came_in_to', '2026-12-31', 'id_accident_state', 9, 'attorney_is_standard', true, 'pip_insurance_not', 'LOP', 'id_legal_dim_not_in', JSON_ARRAY(13))),
('cnv_fl_cor_may_dec_no_case', 'Florida COR May-Dic NO CASE genérico → 1', 812, 1.00,
  JSON_OBJECT('id_tx_dim', 1, 'date_came_in_from', '2026-05-01', 'date_came_in_to', '2026-12-31', 'id_accident_state', 9, 'attorney_is_standard', true, 'pip_insurance_not', 'LOP', 'id_legal_dim', 13, 'id_legal_status_not_in', JSON_ARRAY(@no_case_at_fault))),
('cnv_fl_cor_may_dec_at_fault', 'Florida COR May-Dic NO CASE CLIENT AT FAULT → 0.33', 813, 0.33,
  JSON_OBJECT('id_tx_dim', 1, 'date_came_in_from', '2026-05-01', 'date_came_in_to', '2026-12-31', 'id_accident_state', 9, 'attorney_is_standard', true, 'pip_insurance_not', 'LOP', 'id_legal_status', @no_case_at_fault)),

('cnv_ny_apr_jun_15', 'New York Abr 24 – Jun 14 2026 → 1.5', 820, 1.50,
  JSON_OBJECT('date_came_in_from', '2026-04-24', 'date_came_in_before', '2026-06-15', 'id_accident_state', 32)),
('cnv_ny_shulman_jun_15', 'New York Jun 15-30 Shulman & Hill → 1.5', 821, 1.50,
  JSON_OBJECT('date_came_in_from', '2026-06-15', 'date_came_in_to', '2026-06-30', 'id_attorney', @shulman_id, 'id_accident_state', 32)),

('cnv_confirmed_special_default', 'CONFIRMED + special active → 1', 901, 1.00,
  JSON_OBJECT('id_legal_dim', 12, 'date_came_in_on_or_after', '2025-06-01', 'excluded_confirmed', false, 'special_active', true)),
('cnv_confirmed_special_barry', 'CONFIRMED + special + Barry → 0.33', 902, 0.33,
  JSON_OBJECT('id_legal_dim', 12, 'date_came_in_on_or_after', '2025-06-01', 'excluded_confirmed', false, 'special_active', true, 'id_attorney', @barry_id)),
('cnv_confirmed_fl_feb_apr', 'CONFIRMED + FL COR Feb-Abr → 1.5', 903, 1.50,
  JSON_OBJECT('id_legal_dim', 12, 'date_came_in_on_or_after', '2025-06-01', 'excluded_confirmed', false, 'special_active', true, 'id_tx_dim', 1, 'date_came_in_from', '2026-02-11', 'date_came_in_to', '2026-04-30', 'id_accident_state', 9, 'attorney_is_standard', true, 'id_attorney_not', @barry_id)),
('cnv_confirmed_fl_may_dec', 'CONFIRMED + FL COR May-Dic → 1.5', 904, 1.50,
  JSON_OBJECT('id_legal_dim', 12, 'date_came_in_on_or_after', '2025-06-01', 'excluded_confirmed', false, 'special_active', true, 'id_tx_dim', 1, 'date_came_in_from', '2026-05-01', 'date_came_in_to', '2026-12-31', 'id_accident_state', 9, 'attorney_is_standard', true, 'pip_insurance_not', 'LOP', 'id_attorney_not', @barry_id)),
('cnv_confirmed_ny_apr', 'CONFIRMED + NY Abr-Jun → 1.5', 905, 1.50,
  JSON_OBJECT('id_legal_dim', 12, 'date_came_in_on_or_after', '2025-06-01', 'excluded_confirmed', false, 'special_active', true, 'date_came_in_from', '2026-04-24', 'date_came_in_before', '2026-06-15', 'id_accident_state', 32, 'id_attorney_not', @barry_id)),
('cnv_confirmed_ny_shulman', 'CONFIRMED + NY Shulman Jun → 1.5', 906, 1.50,
  JSON_OBJECT('id_legal_dim', 12, 'date_came_in_on_or_after', '2025-06-01', 'excluded_confirmed', false, 'special_active', true, 'date_came_in_from', '2026-06-15', 'date_came_in_to', '2026-06-30', 'id_attorney', @shulman_id, 'id_accident_state', 32)),

('cnv_no_case_client_at_fault', 'NO CASE CLIENT AT FAULT desde mayo 2026', 950, 0.33,
  JSON_OBJECT('id_legal_status', @no_case_at_fault, 'date_came_in_on_or_after', '2026-05-01')),

('cnv_minor_review', 'Menor de edad en revisión', 9900, 0.00,
  JSON_OBJECT('is_minor', true, 'date_came_in_on_or_after', '2026-03-01', 'id_log_status_not_in', JSON_ARRAY(2), 'id_legal_dim_not', 12)),

('cnv_special_dropped', 'SpecialList DROPPED anula', 10000, 0.00,
  JSON_OBJECT('special_dropped', true)),
('cnv_log_dropped', 'LogStatus DROPPED anula', 10001, 0.00,
  JSON_OBJECT('id_log_status', 2));
