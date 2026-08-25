-- Historial transaccional por registro (≈ SGC LOGED + LOGEDDET).
-- Cabecera: 1 fila por registro de negocio (entity_table + entity_pk).
-- Detalle: cada insert/update/delete sobre ese registro.
-- Aplicar con: npm run patch:entity-log

CREATE TABLE IF NOT EXISTS entity_log (
  id_log bigint unsigned NOT NULL AUTO_INCREMENT,
  entity_table varchar(64) NOT NULL COMMENT 'Tabla del registro (lead, client, …)',
  entity_pk varchar(64) NOT NULL COMMENT 'PK del registro como string',
  line_count smallint unsigned NOT NULL DEFAULT 0 COMMENT 'Cantidad de líneas en log_detail',
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Alta del registro / primera entrada',
  PRIMARY KEY (id_log),
  UNIQUE KEY uk_entity_log_record (entity_table, entity_pk),
  KEY idx_entity_log_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Cabecera de log por registro de negocio (1:1 lógico con fila transaccional)';

CREATE TABLE IF NOT EXISTS log_detail (
  id_log_detail bigint unsigned NOT NULL AUTO_INCREMENT,
  id_log bigint unsigned NOT NULL,
  occurred_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  operation char(1) NOT NULL COMMENT 'I=insert U=update D=delete',
  module_name varchar(40) DEFAULT NULL COMMENT 'Pantalla / módulo (≈ LgPgName)',
  transaction_name varchar(60) DEFAULT NULL COMMENT 'Transacción en código (≈ LgPgTrn)',
  notes varchar(500) DEFAULT NULL COMMENT 'Observaciones (≈ LgObservaciones)',
  id_actor_user int DEFAULT NULL COMMENT 'app_user.id_user',
  id_actor_persona int DEFAULT NULL COMMENT 'SECURITY persona (sin FK cross-DB)',
  actor_ip varchar(45) DEFAULT NULL,
  actor_host varchar(60) DEFAULT NULL COMMENT 'Usuario PC / hostname',
  before_json json DEFAULT NULL COMMENT 'Snapshot antes (U/D)',
  after_json json DEFAULT NULL COMMENT 'Snapshot después (I/U)',
  PRIMARY KEY (id_log_detail),
  KEY idx_log_detail_log (id_log, occurred_at),
  KEY idx_log_detail_occurred (occurred_at),
  KEY idx_log_detail_actor (id_actor_user),
  CONSTRAINT fk_log_detail_log FOREIGN KEY (id_log) REFERENCES entity_log (id_log),
  CONSTRAINT fk_log_detail_actor_user FOREIGN KEY (id_actor_user) REFERENCES app_user (id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Detalle de cambios por registro (timeline append-only)';
