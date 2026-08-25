-- =============================================================================
-- Renombrar schema MySQL: TNFG_MRUIZ → TNFG_INTAKE
--
-- ⚠️  MySQL 8 bloquea RENAME TABLE entre schemas si hay FKs:
--     [HY000][1450] Changing schema from 'TNFG_MRUIZ' to 'TNFG_INTAKE' is not allowed.
--
-- Usar en su lugar el script bash (mysqldump → import):
--   cd lead-normalize-migration
--   bash scripts/rename-schema-to-tnfg-intake.sh
--   bash scripts/rename-schema-to-tnfg-intake.sh --drop-old
--
-- Este archivo queda solo para diagnóstico previo/post.
-- =============================================================================

SET NAMES utf8mb4;

SET @old_schema := 'TNFG_MRUIZ';
SET @new_schema := 'TNFG_INTAKE';

SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME
FROM information_schema.SCHEMATA
WHERE SCHEMA_NAME IN (@old_schema, @new_schema)
ORDER BY SCHEMA_NAME;

SELECT table_schema, table_type, COUNT(*) AS cnt
FROM information_schema.tables
WHERE table_schema IN (@old_schema, @new_schema)
GROUP BY table_schema, table_type
ORDER BY table_schema, table_type;

SELECT
  @old_schema AS old_schema,
  @new_schema AS new_schema,
  (SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = @old_schema) AS old_exists,
  (SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = @new_schema) AS new_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @old_schema) AS old_objects,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @new_schema) AS new_objects;
