-- Quién escribió esta membresía.
--   GLIDE  → la derivó sync:users desde g_users + el catálogo de oficinas.
--   PORTAL → la escribió la app nueva al dar de alta o editar un usuario.
--
-- No es una marca de propiedad permanente. Mientras una persona exista en
-- g_users, Glide sigue mandando sobre ella: el sync borra todas sus filas, sin
-- mirar el origen, y las rehace. Lo que la columna permite es distinguir las
-- filas derivadas que quedaron colgadas de alguien que ya salió de g_users, y
-- borrarlas también — sin perder de paso la jerarquía de los usuarios que
-- g_users no conoce, que son los que nacen en el portal.
--
-- Antes de esto el sync hacía TRUNCATE de la tabla entera cada 3 minutos, así
-- que esos usuarios quedaban sin jerarquía a los pocos minutos de crearlos.
--
-- El default es PORTAL porque el INSERT del intake-api no lista la columna: lo
-- que escribe la app nueva queda marcado solo con el default, sin tocar esa API.

ALTER TABLE hierarchy_membership
  ADD COLUMN origin ENUM('GLIDE','PORTAL') NOT NULL DEFAULT 'PORTAL'
    COMMENT 'Quién escribió la fila — GLIDE (derivada de g_users) | PORTAL (escrita por la app nueva)'
    AFTER is_active,
  ADD KEY idx_hierarchy_membership_origin (origin);
