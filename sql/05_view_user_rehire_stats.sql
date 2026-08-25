-- Cuántas veces se fue y regresó (pasadas laborales por persona)
CREATE OR REPLACE VIEW v_user_rehire_stats AS
SELECT
  u.id_user,
  u.email,
  u.display_name,
  u.hr_status AS current_hr_status,
  u.is_active,
  COUNT(p.period_id) + CASE WHEN u.is_active = 1 THEN 1 ELSE 0 END AS employment_stints,
  GREATEST(
    COUNT(p.period_id) + CASE WHEN u.is_active = 1 THEN 1 ELSE 0 END - 1,
    0
  ) AS times_left_and_returned,
  SUM(CASE WHEN LOWER(TRIM(p.hr_status)) = 'termed' OR p.termed_at IS NOT NULL THEN 1 ELSE 0 END)
    + CASE
        WHEN u.is_active = 0 AND (LOWER(TRIM(u.hr_status)) = 'termed' OR u.termed_at IS NOT NULL)
          AND COUNT(p.period_id) = 0
        THEN 1
        ELSE 0
      END AS termed_stints,
  COALESCE(MIN(p.hired_at), u.hired_at) AS first_hired_at,
  COALESCE(MAX(p.termed_at), u.termed_at) AS last_termed_at
FROM app_user u
LEFT JOIN user_hr_period p ON p.id_user = u.id_user
GROUP BY
  u.id_user,
  u.email,
  u.display_name,
  u.hr_status,
  u.is_active,
  u.hired_at,
  u.termed_at;
