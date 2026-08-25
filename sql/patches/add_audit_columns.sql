-- Columnas de auditoría estándar. Aplicar con: npm run patch:audit-columns

-- client
ALTER TABLE client
  ADD COLUMN updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
  ADD COLUMN created_by_user_id int DEFAULT NULL AFTER updated_at,
  ADD COLUMN updated_by_user_id int DEFAULT NULL AFTER created_by_user_id;

ALTER TABLE client
  ADD KEY idx_client_created_by (created_by_user_id),
  ADD KEY idx_client_updated_by (updated_by_user_id),
  ADD CONSTRAINT fk_client_created_by FOREIGN KEY (created_by_user_id) REFERENCES app_user (id_user),
  ADD CONSTRAINT fk_client_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES app_user (id_user);

UPDATE client c
INNER JOIN lead_party lp ON lp.id_client = c.id_client
INNER JOIN `lead` l ON l.id_lead = lp.id_lead
SET
  c.created_by_user_id = COALESCE(c.created_by_user_id, l.created_by_user_id),
  c.updated_by_user_id = COALESCE(c.updated_by_user_id, l.updated_by_user_id, l.created_by_user_id),
  c.updated_at = COALESCE(l.updated_at, c.created_at);

-- client_channel
ALTER TABLE client_channel
  ADD COLUMN updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
  ADD COLUMN created_by_user_id int DEFAULT NULL AFTER updated_at,
  ADD COLUMN updated_by_user_id int DEFAULT NULL AFTER created_by_user_id;

ALTER TABLE client_channel
  ADD KEY idx_channel_created_by (created_by_user_id),
  ADD KEY idx_channel_updated_by (updated_by_user_id),
  ADD CONSTRAINT fk_channel_created_by FOREIGN KEY (created_by_user_id) REFERENCES app_user (id_user),
  ADD CONSTRAINT fk_channel_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES app_user (id_user);

UPDATE client_channel cc
INNER JOIN client c ON c.id_client = cc.id_client
SET
  cc.created_by_user_id = c.created_by_user_id,
  cc.updated_by_user_id = c.updated_by_user_id,
  cc.updated_at = c.updated_at;

-- client_address
ALTER TABLE client_address
  ADD COLUMN updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
  ADD COLUMN created_by_user_id int DEFAULT NULL AFTER updated_at,
  ADD COLUMN updated_by_user_id int DEFAULT NULL AFTER created_by_user_id;

ALTER TABLE client_address
  ADD KEY idx_address_created_by (created_by_user_id),
  ADD KEY idx_address_updated_by (updated_by_user_id),
  ADD CONSTRAINT fk_address_created_by FOREIGN KEY (created_by_user_id) REFERENCES app_user (id_user),
  ADD CONSTRAINT fk_address_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES app_user (id_user);

UPDATE client_address ca
INNER JOIN client c ON c.id_client = ca.id_client
SET
  ca.created_by_user_id = c.created_by_user_id,
  ca.updated_by_user_id = c.updated_by_user_id,
  ca.updated_at = c.updated_at;

-- user_access_grant
ALTER TABLE user_access_grant
  ADD COLUMN updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
  ADD COLUMN updated_by_user_id int DEFAULT NULL AFTER granted_by_user_id;

ALTER TABLE user_access_grant
  ADD KEY idx_grant_updated_by (updated_by_user_id),
  ADD CONSTRAINT fk_grant_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES app_user (id_user);

UPDATE user_access_grant
SET updated_by_user_id = granted_by_user_id,
    updated_at = created_at
WHERE updated_by_user_id IS NULL;

-- lead: quitar email legacy (FK + lead_staff conservan trazabilidad)
ALTER TABLE `lead`
  DROP COLUMN created_by,
  DROP COLUMN updated_by;
