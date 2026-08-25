-- client.id_linked_user → app_user (empleado que también es client). npm run patch:client-linked-user

ALTER TABLE client
  ADD COLUMN id_linked_user int DEFAULT NULL COMMENT 'FK app_user si el client es también empleado TNFG' AFTER updated_by_user_id;

ALTER TABLE client
  ADD KEY idx_client_linked_user (id_linked_user),
  ADD CONSTRAINT fk_client_linked_user FOREIGN KEY (id_linked_user) REFERENCES app_user (id_user);
