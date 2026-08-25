-- Overrides log status (ex-SP imperativo). Condiciones por ID.
-- ref_log_status: 1=ACTIVE, 2=DROPPED | refLeadStatus Came In = 9 | ref_state FL = 9
SET NAMES utf8mb4;

DELETE FROM ref_log_status_override_rule WHERE rule_code LIKE 'ovr_%';

INSERT INTO ref_log_status_override_rule (rule_code, description, priority, id_log_status, condition_json) VALUES
('ovr_non_fl_confirmed', 'Fuera FL: legal CONFIRMED → ACTIVE', 500, 1,
  JSON_OBJECT('id_accident_state_not_in', JSON_ARRAY(9), 'id_legal_dim', 12, 'attorney_is_standard', true, 'skip_if_special_list', true)),
('ovr_non_fl_no_case', 'Fuera FL: legal NO CASE → DROPPED', 501, 2,
  JSON_OBJECT('id_accident_state_not_in', JSON_ARRAY(9), 'id_legal_dim', 13, 'attorney_is_standard', true, 'skip_if_special_list', true)),

('ovr_fl_confirmed_2026', 'Florida 2026+: CONFIRMED → ACTIVE', 600, 1,
  JSON_OBJECT('id_accident_state', 9, 'id_legal_dim', 12, 'attorney_is_standard', true, 'id_tx_dim_not_in', JSON_ARRAY(2,3), 'date_came_in_on_or_after', '2026-01-01', 'skip_if_special_list', true)),
('ovr_fl_visits_12_2026', 'Florida 2026+: visits >= 12 → ACTIVE', 601, 1,
  JSON_OBJECT('id_accident_state', 9, 'visits_gte', 12, 'attorney_is_standard', true, 'id_tx_dim_not_in', JSON_ARRAY(2,3), 'date_came_in_on_or_after', '2026-01-01', 'skip_if_special_list', true)),
('ovr_fl_no_case_active_ldot_2026', 'Florida 2026+: NO CASE + clínico ACTIVE + LDOT<30 → ACTIVE', 602, 1,
  JSON_OBJECT('id_accident_state', 9, 'id_legal_dim', 13, 'id_clinical_dim', 15, 'ldot_days_lt', 30, 'attorney_is_standard', true, 'id_tx_dim_not_in', JSON_ARRAY(2,3), 'date_came_in_on_or_after', '2026-01-01', 'skip_if_special_list', true)),
('ovr_fl_no_case_active_2026', 'Florida 2026+: NO CASE + clínico ACTIVE → ACTIVE', 603, 1,
  JSON_OBJECT('id_accident_state', 9, 'id_legal_dim', 13, 'id_clinical_dim', 15, 'attorney_is_standard', true, 'id_tx_dim_not_in', JSON_ARRAY(2,3), 'date_came_in_on_or_after', '2026-01-01', 'skip_if_special_list', true)),
('ovr_fl_clinical_dropped_2026', 'Florida 2026+: clínico DROPPED sin CONFIRMED → DROPPED', 604, 2,
  JSON_OBJECT('id_accident_state', 9, 'id_legal_dim_not', 12, 'id_clinical_dim', 16, 'attorney_is_standard', true, 'id_tx_dim_not_in', JSON_ARRAY(2,3), 'date_came_in_on_or_after', '2026-01-01', 'skip_if_special_list', true)),
('ovr_fl_no_case_dropped_2026', 'Florida 2026+: NO CASE → DROPPED', 605, 2,
  JSON_OBJECT('id_accident_state', 9, 'id_legal_dim', 13, 'attorney_is_standard', true, 'id_tx_dim_not_in', JSON_ARRAY(2,3), 'date_came_in_on_or_after', '2026-01-01', 'skip_if_special_list', true)),
('ovr_fl_stale_ldot', 'Florida: LDOT>30 + visits<12 sin CONFIRMED → DROPPED', 610, 2,
  JSON_OBJECT('id_accident_state', 9, 'visits_lt', 12, 'ldot_days_gt', 30, 'id_legal_dim_not', 12, 'attorney_is_standard', true, 'id_tx_dim_not_in', JSON_ARRAY(2,3), 'skip_if_special_list', true, 'id_log_status_not_in', JSON_ARRAY(2))),

('ovr_special_list', 'SpecialList override', 900, 1,
  JSON_OBJECT('has_special_list_status', true));

-- Nota: ovr_special_list usa id_log_status placeholder; evaluador aplica ctx.id_special_log_status directamente.
