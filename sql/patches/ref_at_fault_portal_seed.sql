-- Opciones At Fault del portal Edit Lead → ref_at_fault_type
INSERT IGNORE INTO ref_at_fault_type (display_name, normalized_name) VALUES
  ('Unknown', 'unknown'),
  ('No One Cited', 'no one cited'),
  ('3rd Party Cited', '3rd party cited'),
  ('Cited', 'cited');
