-- El estado legal y clínico vigente del lead según Glide.
--
-- No es lo mismo que lead_legal.id_legal_status, que salió de
-- tblLeads.legalStatus al migrar. Esos dos campos se contradicen dentro de
-- Glide: para los mismos leads, tblLeads dice "Pending" y esta tabla dice
-- "CONFIRMED". El tablero LogReport lee esta, no aquella, y de acá salen tanto
-- el LegalStatus como el convertedValue que deciden si un caso se pinta verde.
--
-- Una fila por lead, que Glide actualiza en su lugar: 55.960 filas para 55.960
-- leads. Por eso la identidad es el Id de origen y no hay secuencia local.
--
-- Mientras el portal no administre estos estados, el modelo los guarda en vez
-- de derivarlos — que es justo lo que no podíamos hacer antes y dejaba al
-- datamart reconstruyendo un valor que no coincidía con producción.

CREATE TABLE IF NOT EXISTS lead_legal_clinical_status (
  glide_status_id int NOT NULL COMMENT 'Id en prod.tblLeadsDataLegalClinicalStatus — identidad de origen',
  id_lead         int NOT NULL COMMENT 'PK local del lead',
  glide_lead_id   int NOT NULL COMMENT 'IdLead en Glide — para reconciliar contra prod',
  id_lead_old     varchar(255) DEFAULT NULL,
  attorney        varchar(255) DEFAULT NULL,
  tx_location     varchar(255) DEFAULT NULL,
  clinical_status varchar(255) DEFAULT NULL,
  legal_status    varchar(255) DEFAULT NULL,
  idot            date DEFAULT NULL,
  ldot            date DEFAULT NULL,
  converted_value decimal(4,2) DEFAULT NULL COMMENT 'pesa en el Confirmed del tablero',
  visits          smallint DEFAULT NULL,
  created_at      datetime DEFAULT NULL COMMENT 'CreatedAt en Glide',
  row_changed_at  datetime DEFAULT NULL COMMENT 'columna incremental — la lee el ETL del datamart',
  is_miscellaneous tinyint(1) DEFAULT NULL,
  synced_at       datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (glide_status_id),
  UNIQUE KEY uk_lead_legal_clinical_lead (id_lead),
  KEY idx_lead_legal_clinical_glide_lead (glide_lead_id),
  KEY idx_lead_legal_clinical_changed (row_changed_at),
  KEY idx_lead_legal_clinical_legal (legal_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
