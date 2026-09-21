-- La vista que lee el ETL del datamart, ahora apoyada en el espejo.
--
-- Antes derivaba LegalStatus de refLegalStatus vía lead_legal, y ese camino
-- devolvía "Pending" para 35.841 leads que Glide tiene en CONFIRMED. No era un
-- error de la migración: tblLeads.legalStatus dice Pending para esos mismos
-- leads, y Glide dejó de mantener ese campo. El estado vivo está en
-- tblLeadsDataLegalClinicalStatus, que es lo que el espejo trae.
--
-- convertedValue viene del mismo lado por la misma razón: pesa en el Confirmed
-- del tablero, y el l.cnv_value del modelo arrastra el mismo desfase.
--
-- Id es la identidad de origen (Id de Glide) y la PK del staging.
-- IdLead es glide_lead_id, igual que v_tblLeads.idLead / prod.tblLeads.idLead.
-- Repuntar esta vista obliga a truncar stg_tblLeadsDataLegalClinicalStatus y
-- resetear su watermark, o quedan conviviendo filas de las dos numeraciones.

CREATE OR REPLACE VIEW tblLeadsDataLegalClinicalStatus AS
SELECT
  m.glide_status_id  AS Id,
  m.glide_lead_id    AS IdLead,
  CAST(m.glide_lead_id AS CHAR CHARSET utf8mb4) AS IdLeadStr,
  m.id_lead_old      AS IdLeadOld,
  m.attorney         AS Attorney,
  m.tx_location      AS TxLocation,
  m.clinical_status  AS ClinicalStatus,
  m.legal_status     AS LegalStatus,
  m.idot             AS IDOT,
  m.ldot             AS LDOT,
  m.converted_value  AS convertedValue,
  m.visits           AS Visits,
  m.created_at       AS CreatedAt,
  m.row_changed_at   AS row_changed_at,
  m.is_miscellaneous AS isMiscellaneous
FROM lead_legal_clinical_status m;
