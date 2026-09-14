-- lead.id_lead → AUTO_INCREMENT. Lo asigna siempre la base, tanto para los leads
-- del portal como para los que trae la migración: la identidad de Glide es glide_id.
ALTER TABLE `lead`
  MODIFY COLUMN id_lead int NOT NULL AUTO_INCREMENT;
