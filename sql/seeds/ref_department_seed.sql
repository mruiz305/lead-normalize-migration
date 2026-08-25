-- Seed departamentos legacy (dbProduction.departments) — IDs preservados para Portal
INSERT INTO ref_department (department_id, department_name, is_active) VALUES
  (1, 'EXEC', 1),
  (2, 'General Clinic User', 1),
  (3, 'Human Resources', 1),
  (4, 'Intake', 1),
  (5, 'Marketing', 1),
  (6, 'STAFF', 1),
  (7, 'Technology', 1)
ON DUPLICATE KEY UPDATE
  department_name = VALUES(department_name),
  is_active = VALUES(is_active);
