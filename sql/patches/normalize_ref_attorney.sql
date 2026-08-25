-- ref_attorney: id_state FK inline. npm run patch:normalize-ref-attorney

ALTER TABLE ref_attorney
  ADD COLUMN id_state smallint DEFAULT NULL COMMENT 'FK ref_state' AFTER is_active,
  ADD KEY idx_attorney_state (id_state);

ALTER TABLE ref_attorney
  ADD CONSTRAINT fk_attorney_state FOREIGN KEY (id_state) REFERENCES ref_state (id_state);

DROP TABLE IF EXISTS ref_attorney_state;
