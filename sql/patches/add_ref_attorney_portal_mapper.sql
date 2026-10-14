-- Nombre de abogado prod → portal (espejo de dbProduction.refAttorneys_portal_mapper).
-- La crea y la llena `npm run sync:attorney-mapper`, que también corre en cada sync:ops.
-- El datamart nuevo la copia como stg_refAttorneys_portal_mapper y la usa
-- sp_refresh_stg_lead_status para encontrar el caso del portal cuando el nombre cambió.
CREATE TABLE IF NOT EXISTS ref_attorney_portal_mapper (
  id INT NOT NULL COMMENT 'Mismo id que dbProduction.refAttorneys_portal_mapper',
  attorney_prod VARCHAR(255) NOT NULL COMMENT 'Nombre del abogado en el lead (Glide/prod)',
  attorney_portal VARCHAR(255) NOT NULL COMMENT 'Nombre del abogado en los casos del portal',
  createdAt DATETIME NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_attorney_prod (attorney_prod)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Espejo de prod refAttorneys_portal_mapper: nombre de abogado prod → portal';
