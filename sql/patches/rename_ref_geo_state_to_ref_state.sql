-- ref_geo_state → ref_state. Aplicar con: npm run patch:rename-ref-state

RENAME TABLE ref_geo_state TO ref_state;

ALTER TABLE ref_state
  RENAME INDEX uk_geo_state_code TO uk_state_code,
  RENAME INDEX uk_geo_state_name TO uk_state_name;
