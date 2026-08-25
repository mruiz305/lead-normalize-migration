-- =============================================================================
-- Índices para Case Manager API (lecturas sobre modelo normalizado TNFG)
-- Aplicar: npm run patch:case-manager-indexes
-- Idempotente vía script (comprueba information_schema.STATISTICS)
-- =============================================================================

-- lead: listados por status + orden created / id
-- ALTER TABLE `lead` ADD INDEX idx_cm_lead_status_created (id_lead_status, created_at);

-- lead: hot leads
-- ALTER TABLE `lead` ADD INDEX idx_cm_lead_hot_status (is_hot_lead, id_lead_status);

-- lead: rep request drop
-- ALTER TABLE `lead` ADD INDEX idx_cm_lead_requested_drop (requested_drop, id_lead_status);

-- lead_timeline: locked-down-today, lock-down-drops
-- ALTER TABLE lead_timeline ADD INDEX idx_cm_lt_locked_down (date_locked_down);
-- ALTER TABLE lead_timeline ADD INDEX idx_cm_lt_dropped (date_dropped);

-- lead_party: primary injured party por lead
-- ALTER TABLE lead_party ADD INDEX idx_cm_party_primary (id_lead, is_primary_party);

-- lead_staff: submitter / intake por lead
-- ALTER TABLE lead_staff ADD INDEX idx_cm_staff_lead_kind (id_lead, id_staff_kind);

-- lead_note: accident notes en detalle / PATCH
-- ALTER TABLE lead_note ADD INDEX idx_cm_note_lead_type (id_lead, note_type);

-- lead_org_snapshot: scope jerárquico (OR legacy emails)
-- ALTER TABLE lead_org_snapshot ADD INDEX idx_cm_org_team (team);
-- ALTER TABLE lead_org_snapshot ADD INDEX idx_cm_org_office (office_legacy);
-- ALTER TABLE lead_org_snapshot ADD INDEX idx_cm_org_pod (pod);
-- ALTER TABLE lead_org_snapshot ADD INDEX idx_cm_org_region (region);
-- ALTER TABLE lead_org_snapshot ADD INDEX idx_cm_org_directorate (directorate);
