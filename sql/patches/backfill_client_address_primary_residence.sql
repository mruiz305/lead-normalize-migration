-- Direcciones RESIDENCE guardadas sin is_primary=1 no aparecen en Edit Lead (GET filtra is_primary=1).
-- Marca la más reciente por client como primaria activa.

UPDATE client_address ca
INNER JOIN ref_address_kind ak
  ON ak.id_address_kind = ca.id_address_kind AND ak.kind_code = 'RESIDENCE'
INNER JOIN (
  SELECT ca2.id_client, MAX(ca2.id_address) AS id_address
  FROM client_address ca2
  INNER JOIN ref_address_kind ak2
    ON ak2.id_address_kind = ca2.id_address_kind AND ak2.kind_code = 'RESIDENCE'
  GROUP BY ca2.id_client
) latest ON latest.id_client = ca.id_client AND latest.id_address = ca.id_address
SET ca.is_primary = 1, ca.is_active = 1
WHERE ca.is_primary = 0;
