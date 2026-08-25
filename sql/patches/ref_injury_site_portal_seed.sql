-- Picklist Edit Lead — Injuries (antes hardcode en InjuryDamageSection.tsx).
-- Columna portal_sort_order + seed de las 23 opciones del Portal.

INSERT INTO ref_injury_site (display_name, normalized_name, portal_sort_order, is_active) VALUES
  ('Neck Injuries', 'neck injuries', 1, 1),
  ('Back Injuries', 'back injuries', 2, 1),
  ('Chest Injuries', 'chest injuries', 3, 1),
  ('Abdominal Injuries', 'abdominal injuries', 4, 1),
  ('Fractures and Broken Bones', 'fractures and broken bones', 5, 1),
  ('Shoulder Injuries', 'shoulder injuries', 6, 1),
  ('Knee Injuries', 'knee injuries', 7, 1),
  ('Facial Injuries', 'facial injuries', 8, 1),
  ('Lacerations and Bruises', 'lacerations and bruises', 9, 1),
  ('Foot and Ankle Injuries', 'foot and ankle injuries', 10, 1),
  ('Hand and Wrist Injuries', 'hand and wrist injuries', 11, 1),
  ('Pelvic Injuries', 'pelvic injuries', 12, 1),
  ('Soft Tissue Injuries', 'soft tissue injuries', 13, 1),
  ('Eye Injuries', 'eye injuries', 14, 1),
  ('Seat Belt Injuries', 'seat belt injuries', 15, 1),
  ('Ear Injuries', 'ear injuries', 16, 1),
  ('Burn Injuries', 'burn injuries', 17, 1),
  ('Psychological Injuries', 'psychological injuries', 18, 1),
  ('Arm', 'arm', 19, 1),
  ('Leg', 'leg', 20, 1),
  ('Deceased', 'deceased', 21, 1),
  ('Coma', 'coma', 22, 1),
  ('Brain Damage', 'brain damage', 23, 1)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  portal_sort_order = VALUES(portal_sort_order),
  is_active = VALUES(is_active);
