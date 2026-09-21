-- Índices para JOIN LATERAL de v_tblLeads (lookups por id_lead / id_client).
-- Idempotente: ignora ER_DUP_KEYNAME (1061).

ALTER TABLE lead_staff
  ADD INDEX idx_lead_staff_kind_lead (id_staff_kind, id_lead);

ALTER TABLE lead_note
  ADD INDEX idx_lead_note_lead_type (id_lead, note_type);

ALTER TABLE import_reject
  ADD INDEX idx_reject_lead_field (id_lead, field_name);

ALTER TABLE client_channel
  ADD INDEX idx_channel_client_type_primary (id_client, id_channel_type, is_primary);

ALTER TABLE lead_insurance
  ADD INDEX idx_lead_ins_role_seq (id_lead, insurance_role, party_sequence);

ALTER TABLE client_address
  ADD INDEX idx_address_client_primary (id_client, is_primary, is_active);
