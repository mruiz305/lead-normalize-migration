-- lead.id_lead → AUTO_INCREMENT (nuevos leads); migración sigue insertando id explícito.
ALTER TABLE `lead`
  MODIFY COLUMN id_lead int NOT NULL AUTO_INCREMENT;
