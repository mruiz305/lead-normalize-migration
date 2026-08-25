-- =============================================================================
-- Ejemplos de comparación v_tblLeads vs tblLeads origen
-- Origen está en otro servidor (dbProduction); estas queries son plantillas.
-- =============================================================================

-- 1) Un lead migrado (189 columnas, mismo orden que tblLeads origen)
SELECT * FROM v_tblLeads WHERE idLead = 400500;

-- 2) Conteo migrado
SELECT COUNT(*) AS migrated FROM v_tblLeads;

-- 3) Spot check: campos clave de una muestra
SELECT
  idLead,
  attorney,
  txLocation,
  leadStatus,
  firstName,
  lastName,
  phone,
  officeLabel,
  doa,
  pipInsurance
FROM v_tblLeads
ORDER BY idLead
LIMIT 20;

-- 4) Comparación manual (exporta origen y destino a CSV, o usa cliente con 2 conexiones)
-- En destino:
--   SELECT idLead, attorney, txLocation, leadStatus, firstName, lastName, phone
--   FROM v_tblLeads WHERE idLead BETWEEN 400001 AND 400500;
-- En origen (dbProduction):
--   SELECT idLead, attorney, txLocation, leadStatus, firstName, lastName, phone
--   FROM tblLeads WHERE idLead BETWEEN 400001 AND 400500;

-- 5) Si copias tblLeads origen a tabla staging en destino (solo validación):
/*
CREATE TABLE tblLeads_staging LIKE dbProduction.tblLeads;  -- o import CSV

SELECT
  v.idLead,
  CASE WHEN COALESCE(v.attorney,'') <=> COALESCE(s.attorney,'') THEN 'OK' ELSE 'DIFF' END AS attorney,
  CASE WHEN COALESCE(v.txLocation,'') <=> COALESCE(s.txLocation,'') THEN 'OK' ELSE 'DIFF' END AS txLocation,
  CASE WHEN COALESCE(v.firstName,'') <=> COALESCE(s.firstName,'') THEN 'OK' ELSE 'DIFF' END AS firstName,
  CASE WHEN COALESCE(v.phone,'') <=> COALESCE(s.phone,'') THEN 'OK' ELSE 'DIFF' END AS phone
FROM v_tblLeads v
JOIN tblLeads_staging s ON s.idLead = v.idLead
WHERE COALESCE(v.attorney,'') <> COALESCE(s.attorney,'')
   OR COALESCE(v.txLocation,'') <> COALESCE(s.txLocation,'')
   OR COALESCE(v.firstName,'') <> COALESCE(s.firstName,'')
   OR COALESCE(v.phone,'') <> COALESCE(s.phone,'')
LIMIT 100;
*/

-- 6) Rechazos de migración (FKs sin match)
SELECT id_lead, field_name, raw_value, reject_reason
FROM import_reject
ORDER BY id_lead, field_name;
