-- Portal Edit Lead: Property Damage / Personal Injury (reemplaza hardcode React).
-- Columnas añadidas vía scripts/apply-ref-severity-portal-catalog.js si no existen.

INSERT INTO ref_severity_level (
  id_severity, severity_code, severity_label, sort_order, normalized_name,
  applies_property, applies_personal,
  portal_code_property, portal_code_personal,
  display_label_property, display_label_personal
) VALUES (
  0, 'NA', 'N/A', 0, 'na',
  1, 1, '0', '0',
  'N/A (0 out of 4)', 'N/A (0 out of 3)'
)
ON DUPLICATE KEY UPDATE
  severity_label = VALUES(severity_label),
  sort_order = VALUES(sort_order),
  applies_property = VALUES(applies_property),
  applies_personal = VALUES(applies_personal),
  portal_code_property = VALUES(portal_code_property),
  portal_code_personal = VALUES(portal_code_personal),
  display_label_property = VALUES(display_label_property),
  display_label_personal = VALUES(display_label_personal);

INSERT INTO ref_severity_level (
  id_severity, severity_code, severity_label, sort_order, normalized_name,
  applies_property, applies_personal,
  portal_code_property, portal_code_personal,
  display_label_property, display_label_personal
) VALUES (
  5, 'NO_VISIBLE', 'No Visible Damage', 1, 'no_visible_damage',
  1, 0, '0b', NULL,
  'No Visible Damage (0 out of 4)', NULL
)
ON DUPLICATE KEY UPDATE
  severity_label = VALUES(severity_label),
  sort_order = VALUES(sort_order),
  applies_property = VALUES(applies_property),
  applies_personal = VALUES(applies_personal),
  portal_code_property = VALUES(portal_code_property),
  portal_code_personal = VALUES(portal_code_personal),
  display_label_property = VALUES(display_label_property),
  display_label_personal = VALUES(display_label_personal);

UPDATE ref_severity_level SET
  applies_property = 1,
  applies_personal = IF(id_severity <= 3, 1, 0),
  portal_code_property = CAST(id_severity AS CHAR),
  portal_code_personal = IF(id_severity <= 3, CAST(id_severity AS CHAR), NULL),
  display_label_property = CASE id_severity
    WHEN 1 THEN 'Mild (1 out of 4)'
    WHEN 2 THEN 'Moderate (2 out of 4)'
    WHEN 3 THEN 'High (3 out of 4)'
    WHEN 4 THEN 'Major (4 out of 4)'
    ELSE display_label_property
  END,
  display_label_personal = CASE id_severity
    WHEN 1 THEN 'Mild (1 out of 3)'
    WHEN 2 THEN 'Moderate (2 out of 3)'
    WHEN 3 THEN 'High (3 out of 3)'
    ELSE display_label_personal
  END,
  sort_order = id_severity + 1
WHERE id_severity BETWEEN 1 AND 4;
