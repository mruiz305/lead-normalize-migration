-- Dónde nació el lead, que no es lo mismo que con quién está enlazado.
--   GLIDE  → lo trajo la migración desde prod.tblLeads.
--   PORTAL → lo creó la app nueva. leads-sync-api lo espeja en prod y le
--            escribe el glide_id de vuelta, pero sigue siendo PORTAL: glide_id
--            pasa a ser un puntero al espejo, no una marca de procedencia.
--
-- El default es PORTAL a propósito. El INSERT del intake-api no lista esta
-- columna, así que todo lead creado en la app queda marcado solo con el
-- default. Y si algún camino nuevo inserta sin marcar, el lead queda protegido
-- del remigrate/prune en vez de expuesto a que lo reconstruyan desde prod:
-- ante un olvido preferimos un lead desactualizado antes que uno borrado.

ALTER TABLE `lead`
  ADD COLUMN origin ENUM('GLIDE','PORTAL') NOT NULL DEFAULT 'PORTAL'
    COMMENT 'Origen del lead — GLIDE (migrado desde prod) | PORTAL (creado en la app nueva)'
    AFTER glide_id,
  ADD KEY idx_lead_origin_glide (origin, glide_id);
