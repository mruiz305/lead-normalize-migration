-- ref_insurance_carrier: dos picklists prod (PIP / AT_FAULT). npm run patch:insurance-catalog-scope

ALTER TABLE ref_insurance_carrier
  ADD COLUMN catalog_scope enum('PIP','AT_FAULT') NOT NULL DEFAULT 'PIP'
    COMMENT 'prod refInsurance.type: Insurance / At Fualt'
    AFTER normalized_name;

ALTER TABLE ref_insurance_carrier DROP INDEX uk_carrier_normalized;
ALTER TABLE ref_insurance_carrier
  ADD UNIQUE KEY uk_carrier_scope (normalized_name, catalog_scope),
  ADD KEY idx_carrier_scope (catalog_scope);
