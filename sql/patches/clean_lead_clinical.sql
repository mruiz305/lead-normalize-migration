-- lead_clinical: quitar tx_group / tx_contract_group (viven en ref_tx_location);
-- pip_insurance / at_fault_insurance (canónico en lead_insurance + ref_insurance_carrier).
-- npm run patch:clean-lead-clinical

ALTER TABLE lead_clinical
  DROP COLUMN tx_group,
  DROP COLUMN tx_contract_group;

ALTER TABLE lead_clinical
  DROP COLUMN pip_insurance,
  DROP COLUMN at_fault_insurance;
