-- La base decide el origen, no el código que inserta.
--
-- En el INSERT la distinción es inequívoca: la migración siempre trae glide_id,
-- el portal nunca lo tiene todavía. Derivarlo acá deja de depender de qué
-- versión del código corrió: un proceso viejo que ni sepa que la columna existe
-- igual queda bien marcado. Sin esto, una migración desactualizada omite la
-- columna, cae en el DEFAULT 'PORTAL' y sus leads quedan excluidos del
-- remigrate y del prune para siempre.
--
-- El espejo a prod no rompe la regla: leads-sync-api escribe el glide_id del
-- lead del portal con un UPDATE, y el trigger solo mira el INSERT, así que ese
-- lead conserva su PORTAL y sigue protegido.

DROP TRIGGER IF EXISTS lead_origin_bi;

CREATE TRIGGER lead_origin_bi
BEFORE INSERT ON `lead`
FOR EACH ROW
  SET NEW.origin = IF(NEW.glide_id IS NULL, 'PORTAL', 'GLIDE');
