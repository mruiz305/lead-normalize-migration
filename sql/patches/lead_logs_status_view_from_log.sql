-- La vista que lee el ETL del datamart, ahora apoyada en lead_status_log.
--
-- Antes derivaba el estado desde lead_status_event traduciendo refLeadStatus,
-- y ese camino tenía dos fallas. Una: el catálogo no tiene "Ref Out", así que
-- la vista solo podía emitir ACTIVE, DROPPED o PROBLEM contra el 21% de los
-- leads que en prod son REF OUT. Otra: lead_status_event quedó vacía y la
-- vista devolvía cero filas, así que el staging del datamart se congeló el 5
-- de agosto y el SP pintó de rojo todo lead sin historial.
--
-- Los nombres de las columnas son los que el ETL espera (etl_table_config →
-- stg_tblLeadsLogsStatus): Id es la identidad de origen y la PK del staging,
-- así que el upsert incremental sigue funcionando; row_changed_at es la
-- columna por la que pagina.
--
-- IdLead va en id_lead local, no en glide_id: el datamart cruza contra
-- stg_tblLeads, que sale de v_tblLeads y expone el PK local.

CREATE OR REPLACE VIEW tblLeadsLogsStatus AS
SELECT
  g.glide_log_id   AS Id,
  g.id_lead        AS IdLead,
  g.id_lead_old    AS IdLeadOld,
  g.log_status     AS LogStatus,
  g.created_at     AS CreatedAt,
  g.row_changed_at AS row_changed_at
FROM lead_status_log g;
