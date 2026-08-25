-- id_log en tablas transaccionales → FK entity_log (filtro directo por registro).
-- Requiere entity_log + log_detail (npm run patch:entity-log).
-- Aplicar con: npm run patch:id-log-columns

-- client
ALTER TABLE client
  ADD COLUMN id_log bigint unsigned DEFAULT NULL COMMENT 'FK entity_log' AFTER id_linked_user,
  ADD KEY idx_client_log (id_log),
  ADD CONSTRAINT fk_client_log FOREIGN KEY (id_log) REFERENCES entity_log (id_log);

-- client_channel
ALTER TABLE client_channel
  ADD COLUMN id_log bigint unsigned DEFAULT NULL COMMENT 'FK entity_log' AFTER updated_by_user_id,
  ADD KEY idx_client_channel_log (id_log),
  ADD CONSTRAINT fk_client_channel_log FOREIGN KEY (id_log) REFERENCES entity_log (id_log);

-- client_address
ALTER TABLE client_address
  ADD COLUMN id_log bigint unsigned DEFAULT NULL COMMENT 'FK entity_log' AFTER updated_by_user_id,
  ADD KEY idx_client_address_log (id_log),
  ADD CONSTRAINT fk_client_address_log FOREIGN KEY (id_log) REFERENCES entity_log (id_log);

-- user_channel
ALTER TABLE user_channel
  ADD COLUMN id_log bigint unsigned DEFAULT NULL COMMENT 'FK entity_log' AFTER updated_by_user_id,
  ADD KEY idx_user_channel_log (id_log),
  ADD CONSTRAINT fk_user_channel_log FOREIGN KEY (id_log) REFERENCES entity_log (id_log);

-- user_access_grant
ALTER TABLE user_access_grant
  ADD COLUMN id_log bigint unsigned DEFAULT NULL COMMENT 'FK entity_log' AFTER updated_by_user_id,
  ADD KEY idx_user_access_grant_log (id_log),
  ADD CONSTRAINT fk_user_access_grant_log FOREIGN KEY (id_log) REFERENCES entity_log (id_log);

-- lead
ALTER TABLE `lead`
  ADD COLUMN id_log bigint unsigned DEFAULT NULL COMMENT 'FK entity_log' AFTER updated_at,
  ADD KEY idx_lead_log (id_log),
  ADD CONSTRAINT fk_lead_log FOREIGN KEY (id_log) REFERENCES entity_log (id_log);

-- lead domain (1:1 o hijos)
ALTER TABLE lead_accident
  ADD COLUMN id_log bigint unsigned DEFAULT NULL COMMENT 'FK entity_log' AFTER updated_by_user_id,
  ADD KEY idx_lead_accident_log (id_log),
  ADD CONSTRAINT fk_lead_accident_log FOREIGN KEY (id_log) REFERENCES entity_log (id_log);

ALTER TABLE lead_legal
  ADD COLUMN id_log bigint unsigned DEFAULT NULL COMMENT 'FK entity_log' AFTER updated_by_user_id,
  ADD KEY idx_lead_legal_log (id_log),
  ADD CONSTRAINT fk_lead_legal_log FOREIGN KEY (id_log) REFERENCES entity_log (id_log);

ALTER TABLE lead_clinical
  ADD COLUMN id_log bigint unsigned DEFAULT NULL COMMENT 'FK entity_log' AFTER updated_by_user_id,
  ADD KEY idx_lead_clinical_log (id_log),
  ADD CONSTRAINT fk_lead_clinical_log FOREIGN KEY (id_log) REFERENCES entity_log (id_log);

ALTER TABLE lead_injury
  ADD COLUMN id_log bigint unsigned DEFAULT NULL COMMENT 'FK entity_log' AFTER updated_by_user_id,
  ADD KEY idx_lead_injury_log (id_log),
  ADD CONSTRAINT fk_lead_injury_log FOREIGN KEY (id_log) REFERENCES entity_log (id_log);

ALTER TABLE lead_injury_site
  ADD COLUMN id_log bigint unsigned DEFAULT NULL COMMENT 'FK entity_log' AFTER updated_by_user_id,
  ADD KEY idx_lead_injury_site_log (id_log),
  ADD CONSTRAINT fk_lead_injury_site_log FOREIGN KEY (id_log) REFERENCES entity_log (id_log);

ALTER TABLE lead_org_snapshot
  ADD COLUMN id_log bigint unsigned DEFAULT NULL COMMENT 'FK entity_log' AFTER updated_by_user_id,
  ADD KEY idx_lead_org_snapshot_log (id_log),
  ADD CONSTRAINT fk_lead_org_snapshot_log FOREIGN KEY (id_log) REFERENCES entity_log (id_log);

ALTER TABLE lead_party
  ADD COLUMN id_log bigint unsigned DEFAULT NULL COMMENT 'FK entity_log' AFTER updated_by_user_id,
  ADD KEY idx_lead_party_log (id_log),
  ADD CONSTRAINT fk_lead_party_log FOREIGN KEY (id_log) REFERENCES entity_log (id_log);

ALTER TABLE lead_party_injury_site
  ADD COLUMN id_log bigint unsigned DEFAULT NULL COMMENT 'FK entity_log' AFTER updated_by_user_id,
  ADD KEY idx_lead_party_injury_site_log (id_log),
  ADD CONSTRAINT fk_lead_party_injury_site_log FOREIGN KEY (id_log) REFERENCES entity_log (id_log);

ALTER TABLE lead_insurance
  ADD COLUMN id_log bigint unsigned DEFAULT NULL COMMENT 'FK entity_log' AFTER updated_by_user_id,
  ADD KEY idx_lead_insurance_log (id_log),
  ADD CONSTRAINT fk_lead_insurance_log FOREIGN KEY (id_log) REFERENCES entity_log (id_log);

ALTER TABLE lead_staff
  ADD COLUMN id_log bigint unsigned DEFAULT NULL COMMENT 'FK entity_log' AFTER updated_by_user_id,
  ADD KEY idx_lead_staff_log (id_log),
  ADD CONSTRAINT fk_lead_staff_log FOREIGN KEY (id_log) REFERENCES entity_log (id_log);

ALTER TABLE lead_sync_flag
  ADD COLUMN id_log bigint unsigned DEFAULT NULL COMMENT 'FK entity_log' AFTER updated_by_user_id,
  ADD KEY idx_lead_sync_flag_log (id_log),
  ADD CONSTRAINT fk_lead_sync_flag_log FOREIGN KEY (id_log) REFERENCES entity_log (id_log);
