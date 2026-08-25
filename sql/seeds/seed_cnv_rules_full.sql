-- Reglas CNV completas (migración sp_cnv_value_result). Idempotente por rule_code.
SET NAMES utf8mb4;

DELETE FROM ref_cnv_rule WHERE rule_code LIKE 'cnv_%';

INSERT INTO ref_cnv_rule (rule_code, description, priority, cnv_value, condition_json) VALUES
('cnv_no_case_clinical_dropped', 'NO CASE + Clinical DROPPED + visits<12', 200, 0.00,
  JSON_OBJECT('legal_status_like','NO CASE','clinical_status','DROPPED','visits_lt',12)),
('cnv_no_case_clinical_inactive', 'NO CASE + clínico inactivo + visits<12', 210, 0.00,
  JSON_OBJECT('legal_status_like','NO CASE','clinical_status_not_in', JSON_ARRAY('active','paused','risk99','problem','finalized','settled','referred out'), 'visits_lt',12)),
('cnv_no_case_lop', 'NO CASE + caseType LOP', 220, 0.00,
  JSON_OBJECT('legal_status_like','NO CASE','case_type','LOP')),
('cnv_workers_comp', 'Workers Comp txLocation', 300, 0.33,
  JSON_OBJECT('legal_status_excludes_no_case', true, 'tx_location','workers comp')),
('cnv_barry_misc_active', 'Barry Law Group misc + log ACTIVE/REF OUT', 310, 0.33,
  JSON_OBJECT('is_miscellaneous', true, 'attorney','BARRY LAW GROUP', 'log_status_in', JSON_ARRAY('ACTIVE','REF OUT','ND'))),
('cnv_special_active', 'SpecialList ACTIVE (no Barry)', 700, 1.00,
  JSON_OBJECT('special_active', true, 'attorney_not','BARRY LAW GROUP')),
('cnv_special_active_barry', 'SpecialList ACTIVE + Barry', 710, 0.33,
  JSON_OBJECT('special_active', true, 'attorney','BARRY LAW GROUP')),

('cnv_fl_cor_feb_apr_15', 'Florida COR Feb-Abr 2026 → 1.5', 801, 1.50,
  JSON_OBJECT('tx_location_like','COR %','date_came_in_from','2026-02-11','date_came_in_to','2026-04-30','accident_state','Florida','is_standard_attorney',true,'legal_status_excludes_no_case',true)),
('cnv_fl_cor_feb_apr_no_case', 'Florida COR Feb-Abr NO CASE genérico → 1', 802, 1.00,
  JSON_OBJECT('tx_location_like','COR %','date_came_in_from','2026-02-11','date_came_in_to','2026-04-30','accident_state','Florida','is_standard_attorney',true,'legal_status_like','NO CASE','legal_status_not_like','CLIENT AT FAULT')),
('cnv_fl_cor_feb_apr_at_fault', 'Florida COR Feb-Abr NO CASE CLIENT AT FAULT → 0.33', 803, 0.33,
  JSON_OBJECT('tx_location_like','COR %','date_came_in_from','2026-02-11','date_came_in_to','2026-04-30','accident_state','Florida','is_standard_attorney',true,'legal_status_exact','NO CASE - CLIENT AT FAULT')),

('cnv_fl_cor_may_dec_15', 'Florida COR May-Dic 2026 → 1.5', 811, 1.50,
  JSON_OBJECT('tx_location_like','COR %','date_came_in_from','2026-05-01','date_came_in_to','2026-12-31','accident_state','Florida','is_standard_attorney',true,'pip_insurance_not','LOP','legal_status_excludes_no_case',true)),
('cnv_fl_cor_may_dec_no_case', 'Florida COR May-Dic NO CASE genérico → 1', 812, 1.00,
  JSON_OBJECT('tx_location_like','COR %','date_came_in_from','2026-05-01','date_came_in_to','2026-12-31','accident_state','Florida','is_standard_attorney',true,'pip_insurance_not','LOP','legal_status_like','NO CASE','legal_status_not_like','CLIENT AT FAULT')),
('cnv_fl_cor_may_dec_at_fault', 'Florida COR May-Dic NO CASE CLIENT AT FAULT → 0.33', 813, 0.33,
  JSON_OBJECT('tx_location_like','COR %','date_came_in_from','2026-05-01','date_came_in_to','2026-12-31','accident_state','Florida','is_standard_attorney',true,'pip_insurance_not','LOP','legal_status_exact','NO CASE - CLIENT AT FAULT')),

('cnv_ny_apr_jun_15', 'New York Abr 24 – Jun 14 2026 → 1.5', 820, 1.50,
  JSON_OBJECT('date_came_in_from','2026-04-24','date_came_in_before','2026-06-15','accident_state','New York')),
('cnv_ny_shulman_jun_15', 'New York Jun 15-30 Shulman & Hill → 1.5', 821, 1.50,
  JSON_OBJECT('date_came_in_from','2026-06-15','date_came_in_to','2026-06-30','attorney_equals','Shulman & Hill Lawfirm (MVA)','accident_state','New York')),

('cnv_confirmed_special_default', 'CONFIRMED + special active → 1', 901, 1.00,
  JSON_OBJECT('legal_status','CONFIRMED','date_came_in_on_or_after','2025-06-01','excluded_confirmed',false,'special_active',true)),
('cnv_confirmed_special_barry', 'CONFIRMED + special + Barry → 0.33', 902, 0.33,
  JSON_OBJECT('legal_status','CONFIRMED','date_came_in_on_or_after','2025-06-01','excluded_confirmed',false,'special_active',true,'attorney','BARRY LAW GROUP')),
('cnv_confirmed_fl_feb_apr', 'CONFIRMED + FL COR Feb-Abr → 1.5', 903, 1.50,
  JSON_OBJECT('legal_status','CONFIRMED','date_came_in_on_or_after','2025-06-01','excluded_confirmed',false,'special_active',true,'tx_location_like','COR %','date_came_in_from','2026-02-11','date_came_in_to','2026-04-30','accident_state','Florida','is_standard_attorney',true,'attorney_not','BARRY LAW GROUP')),
('cnv_confirmed_fl_may_dec', 'CONFIRMED + FL COR May-Dic → 1.5', 904, 1.50,
  JSON_OBJECT('legal_status','CONFIRMED','date_came_in_on_or_after','2025-06-01','excluded_confirmed',false,'special_active',true,'tx_location_like','COR %','date_came_in_from','2026-05-01','date_came_in_to','2026-12-31','accident_state','Florida','is_standard_attorney',true,'pip_insurance_not','LOP','attorney_not','BARRY LAW GROUP')),
('cnv_confirmed_ny_apr', 'CONFIRMED + NY Abr-Jun → 1.5', 905, 1.50,
  JSON_OBJECT('legal_status','CONFIRMED','date_came_in_on_or_after','2025-06-01','excluded_confirmed',false,'special_active',true,'date_came_in_from','2026-04-24','date_came_in_before','2026-06-15','accident_state','New York','attorney_not','BARRY LAW GROUP')),
('cnv_confirmed_ny_shulman', 'CONFIRMED + NY Shulman Jun → 1.5', 906, 1.50,
  JSON_OBJECT('legal_status','CONFIRMED','date_came_in_on_or_after','2025-06-01','excluded_confirmed',false,'special_active',true,'date_came_in_from','2026-06-15','date_came_in_to','2026-06-30','attorney_equals','Shulman & Hill Lawfirm (MVA)','accident_state','New York')),

('cnv_no_case_client_at_fault', 'NO CASE CLIENT AT FAULT desde mayo 2026', 950, 0.33,
  JSON_OBJECT('legal_status_exact','NO CASE - CLIENT AT FAULT','date_came_in_on_or_after','2026-05-01')),

('cnv_minor_review', 'Menor de edad en revisión', 9900, 0.00,
  JSON_OBJECT('is_minor', true, 'date_came_in_on_or_after','2026-03-01','log_status_not_in', JSON_ARRAY('DROPPED'), 'legal_status_not_like','CONFIRMED')),

('cnv_special_dropped', 'SpecialList DROPPED anula', 10000, 0.00,
  JSON_OBJECT('special_dropped', true)),
('cnv_log_dropped', 'LogStatus DROPPED anula', 10001, 0.00,
  JSON_OBJECT('log_status','DROPPED'));
