-- Alinear ref_state con dbProduction.refStates (Capitol, acceptsAtFault, hasPIP)
-- IDs 1-50 deben coincidir con refStates.idState para FKs y catálogo Portal.

ALTER TABLE ref_state
  ADD COLUMN capitol varchar(100) DEFAULT NULL COMMENT 'refStates.Capitol' AFTER state_name,
  ADD COLUMN accepts_at_fault tinyint(1) NOT NULL DEFAULT 0 COMMENT 'refStates.acceptsAtFault Yes=1' AFTER capitol,
  ADD COLUMN has_pip tinyint(1) NOT NULL DEFAULT 0 COMMENT 'refStates.hasPIP Yes=1' AFTER accepts_at_fault;
