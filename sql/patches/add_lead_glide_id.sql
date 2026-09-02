-- Puente temporal Glide ↔ norm durante despliegue incremental.
-- Histórico migrado: glide_id = id_lead (= idLead de prod).
-- Leads solo-portal: glide_id NULL hasta enlazar con Glide.
-- Reportes / APIs: siempre usan id_lead como llave.
-- Sync desde Glide: match por glide_id (UNIQUE).

ALTER TABLE `lead`
  ADD COLUMN glide_id INT NULL
    COMMENT 'idLead en Glide/prod — NULL si aún no enlazado'
    AFTER id_lead,
  ADD UNIQUE KEY uk_lead_glide_id (glide_id);
