-- lead_status_event. Aplicar con: npm run patch:lead-status-event

CREATE TABLE IF NOT EXISTS lead_status_event (
  event_id bigint NOT NULL AUTO_INCREMENT,
  id_lead int NOT NULL,
  status_domain enum('LEAD','LEGAL','CLINICAL','STAGE') NOT NULL,
  id_status_from smallint DEFAULT NULL,
  id_status_to smallint NOT NULL,
  changed_at datetime NOT NULL,
  changed_by_user_id int DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id),
  KEY idx_lse_lead (id_lead),
  KEY idx_lse_lead_domain (id_lead, status_domain, changed_at),
  KEY idx_lse_changed (changed_at),
  CONSTRAINT fk_lse_lead FOREIGN KEY (id_lead) REFERENCES `lead` (id_lead),
  CONSTRAINT fk_lse_user FOREIGN KEY (changed_by_user_id) REFERENCES app_user (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Transiciones de estado por dominio (append-only)';
