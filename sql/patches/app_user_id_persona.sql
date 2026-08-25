-- Enlace intake app_user → SECURITY persona (fase 1 visión centralizada)
-- Cross-DB: misma instancia MySQL; FK opcional comentada.

SET @db := DATABASE();

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'app_user' AND COLUMN_NAME = 'id_persona'
);

SET @sql := IF(@col_exists = 0,
  'ALTER TABLE app_user
     ADD COLUMN id_persona int unsigned DEFAULT NULL
       COMMENT ''FK lógica SECURITY_TNFG.persona — identidad central''
     AFTER email,
     ADD KEY idx_app_user_id_persona (id_persona)',
  'SELECT ''id_persona ya existe'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- FK cross-database (descomentar si SECURITY_TNFG está en el mismo servidor):
-- ALTER TABLE app_user
--   ADD CONSTRAINT fk_app_user_persona
--   FOREIGN KEY (id_persona) REFERENCES SECURITY_TNFG.persona (id_persona);
