-- Quién administra esta membresía.
--   GLIDE  → la deriva sync:users desde g_users + el catálogo de oficinas.
--   PORTAL → la administra la app nueva, para usuarios que no existen en
--            g_users y por lo tanto no tienen de dónde derivarse.
--
-- Hasta ahora sync:users hacía TRUNCATE y rehacía la tabla entera cada 3
-- minutos, así que una fila cargada a mano no sobrevivía a un solo tick. Con
-- esta columna el sync borra únicamente lo que sabe reconstruir.
--
-- El default es PORTAL por la misma razón que en lead.origin: si algún camino
-- inserta sin marcar el origen, la fila queda protegida en vez de expuesta a
-- que el próximo sync se la lleve.

ALTER TABLE hierarchy_membership
  ADD COLUMN origin ENUM('GLIDE','PORTAL') NOT NULL DEFAULT 'PORTAL'
    COMMENT 'Quién administra la fila — GLIDE (derivada de g_users) | PORTAL (administrada por la app nueva)'
    AFTER is_active,
  ADD KEY idx_hierarchy_membership_origin (origin);
