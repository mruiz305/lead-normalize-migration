-- El estado operativo del lead según Glide, que no es su leadStatus.
--
-- Glide escribe en tblLeadsLogsStatus un vocabulario propio: ACTIVE, DROPPED,
-- REF OUT y PROBLEM. Los tres primeros no se pueden derivar de lo que ya
-- tenemos migrado — un lead referido a un abogado sigue figurando "Came In" en
-- tblLeads, con abogado asignado y legalStatus Pending, exactamente igual que
-- uno activo. Sin esta tabla el modelo nuevo no tiene con qué distinguirlos, y
-- REF OUT es el 21% de los leads.
--
-- No es un historial: prod tiene 114.409 filas para 114.406 leads, o sea una
-- por lead con su estado vigente, que Glide actualiza en su lugar. Por eso la
-- identidad es el Id de origen y no hay secuencia local.
--
-- De acá cuelga el ColorTag del tablero LogReport: el datamart lee la vista
-- tblLeadsLogsStatus, que ahora se apoya en esta tabla en vez de derivar el
-- estado desde lead_status_event.

CREATE TABLE IF NOT EXISTS lead_status_log (
  glide_log_id   int NOT NULL COMMENT 'Id en prod.tblLeadsLogsStatus — identidad de origen',
  id_lead        int NOT NULL COMMENT 'PK local del lead',
  glide_lead_id  int NOT NULL COMMENT 'IdLead en Glide — para reconciliar contra prod',
  id_lead_old    varchar(255) DEFAULT NULL,
  log_status     varchar(32) NOT NULL COMMENT 'ACTIVE | DROPPED | REF OUT | PROBLEM',
  created_at     datetime DEFAULT NULL COMMENT 'CreatedAt en Glide',
  row_changed_at datetime DEFAULT NULL COMMENT 'columna incremental — la lee el ETL del datamart',
  synced_at      datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (glide_log_id),
  -- Sin UNIQUE en id_lead a propósito: prod tiene 3 leads con dos filas y el
  -- espejo tiene que poder reflejarlo tal cual.
  KEY idx_lead_status_log_lead (id_lead),
  KEY idx_lead_status_log_glide_lead (glide_lead_id),
  KEY idx_lead_status_log_changed (row_changed_at),
  KEY idx_lead_status_log_status (log_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
