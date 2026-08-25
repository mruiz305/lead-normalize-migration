-- =============================================================================
-- v_tblLeads — mismas 189 columnas, mismo orden y nombres que dbProduction.tblLeads
-- Columnas no migradas → NULL. attorney/txLocation usan import_reject si FK falló.
-- `updated`: GREATEST de lead + satélites (+ notes/events) para incremental ETL
--   (etl_table_config.changeColumn = 'updated').
-- Alias `tblLeads` al final para que el ETL lea el nombre legacy sin remap.
-- Aplicar: npm run apply-views
-- =============================================================================

DROP VIEW IF EXISTS tblLeads;
DROP VIEW IF EXISTS v_tblLeads;

CREATE VIEW v_tblLeads AS
SELECT
  l.id_lead AS idLead,
  c_inj.display_name AS name,
  c_inj.first_name AS firstName,
  c_inj.last_name AS lastName,
  c_inj.date_of_birth AS dob,
  c_inj.is_minor AS isMinor,
  ch.phone,
  COALESCE(ch.originalPhoneEntry, ch.phone) AS originalPhoneEntry,
  COALESCE(ch.formattedPhoneEntry, ch.originalPhoneEntry, ch.phone) AS formattedPhoneEntry,
  l.referral_source AS referralSource,
  ch.email,
  l.source_type AS sourceType,
  l.boost_yn AS boostYN,
  notes.leadNotes,
  cl.street,
  cl.unit AS aptSuite,
  cl.city,
  cl.state_name AS residencyState,
  cl.postal_code AS zipCode,
  gs_acc.state_name AS accidentState,
  gs_rep.state_name AS repState,
  st_sub.staff_key AS submitter,
  st_sub.staff_display_name AS submitterName,
  org.duo,
  org.team,
  org.pod,
  org.office_legacy AS office,
  org.region,
  org.directorate,
  org.directorate_name AS directorateName,
  org.region_name AS regionName,
  org.office_name AS officeName,
  org.pod_name AS podName,
  org.team_name AS teamName,
  org.duo_name AS duoName,
  CAST(NULL AS CHAR) AS funder,
  CAST(NULL AS CHAR) AS accessLevel,
  la.date_of_accident AS doa,
  COALESCE(ric_pip.carrier_name, li_pip.carrier_raw) AS pipInsurance,
  COALESCE(ric_af.carrier_name, li_af.carrier_raw) AS atfaultInsurance,
  la.vehicle_description AS vehicleModelYear,
  lc.has_um AS hasUM,
  COALESCE(rtl.display_name, ir.tx_raw) AS txLocation,
  rtl.tx_group AS txGroup,
  rtl.tx_group AS txContractGroup,
  lc.appointment_at AS appointmentDateTime,
  lc.is_telemedicine AS isTeleMedicine,
  COALESCE(ra.display_name, ir.attorney_raw) AS attorney,
  ra.firm_name AS attyFirm,
  ra.contract_group AS attyContractGroup,
  l.internal_source AS internalSource,
  ll.signing_at AS signingDate,
  ll.date_signed AS dateSigned,
  st_int.staff_key AS intakeSpecialist,
  COALESCE(u_cre.email, st_cre.staff_key, st_sub.staff_key) AS creator,
  l.created_at AS created,
  lt.date_created AS dateCreated,
  COALESCE(u_upd.email, st_upd.staff_key, u_cre.email, st_sub.staff_key) AS updater,
  -- Watermark incremental: cualquier cambio en el grafo del lead mueve `updated`
  GREATEST(
    COALESCE(l.updated_at, l.created_at, CAST('1970-01-01' AS DATETIME)),
    COALESCE(ll.updated_at, CAST('1970-01-01' AS DATETIME)),
    COALESCE(lc.updated_at, CAST('1970-01-01' AS DATETIME)),
    COALESCE(lt.updated_at, CAST('1970-01-01' AS DATETIME)),
    COALESCE(la.updated_at, CAST('1970-01-01' AS DATETIME)),
    COALESCE(li.updated_at, CAST('1970-01-01' AS DATETIME)),
    COALESCE(org.updated_at, CAST('1970-01-01' AS DATETIME)),
    COALESCE(lp_inj.updated_at, CAST('1970-01-01' AS DATETIME)),
    COALESCE(c_inj.updated_at, CAST('1970-01-01' AS DATETIME)),
    COALESCE(notes_meta.max_note_at, CAST('1970-01-01' AS DATETIME)),
    COALESCE(evt_meta.max_event_at, CAST('1970-01-01' AS DATETIME))
  ) AS updated,
  rls.leadStatus,
  rcs.clinicalStatus,
  rlg.legalStatus,
  stg.stage_code AS stage,
  lc.requires_transportation AS requiresTransportation,
  c_inj.preferred_language AS preferredLanguage,
  COALESCE(raft.display_name, ir.at_fault_type_raw) AS atFaultType,
  lt.callback_at AS callbackDateTime,
  lt.date_locked_down AS dateLockedDown,
  lt.date_came_in AS dateCameIn,
  lt.date_dropped AS dateDropped,
  ll.date_legal_accepted AS dateLegalAccepted,
  ll.date_legal_rejected AS dateLegalRejected,
  lc.date_clinical_accepted AS dateClinicalAccepted,
  lc.date_clinical_rejected AS dateClinicalRejected,
  lt.reason_pending AS reasonPending,
  lt.reason_drop AS reasonDrop,
  lt.other_drop_reason AS otherDropReason,
  org.office_code AS officeLabel,
  CAST(NULL AS CHAR) AS regionLabel,
  lc.visits,
  lc.idot,
  lc.ldot,
  l.case_type AS caseType,
  COALESCE(ralt.type_code, ir.location_type_raw) AS locationType,
  notes.accidentNotes,
  l.is_vip AS isVIP,
  ll.ticket_attorney AS ticketAttorney,
  la.police_report AS policeReport,
  lt.lka_date AS lkaDate,
  la.driving_rideshare AS drivingRideShare,
  la.passenger_in_rideshare AS psgInRideShare,
  COALESCE(rps.severity_label, ir.property_damage_raw) AS propertyDamage,
  COALESCE(ris.severity_label, ir.personal_injury_raw) AS personalInjury,
  inj_sites.injuries,
  li.fracture,
  li.ambulance,
  li.hospital,
  li.hospital_name AS hospitalName,
  li.xray,
  li.mri,
  li.ct_scans AS ctScans,
  notes.hospitalNotes,
  l.confirmed,
  l.legacy_lead_id AS legacyLeadID,
  l.legacy_case_id AS legacyCaseID,
  l.cnv_value AS cnvValue,
  CAST(NULL AS CHAR) AS regionLable,
  l.is_hot_lead AS isHotLead,
  l.hot_lead_start_at AS hotLeadStartTime,
  l.callback_id AS cbID,
  l.lead_sort_order AS leadSortOrder,
  l.is_callback AS isCallBack,
  la.passenger_count AS passengerCount,
  l.id_media AS idMedia,
  l.link_to_lead_record AS linkToLeadRecord,
  l.accident_or_wc AS accidentOrWC,
  l.intake_view_stepper AS intakeViewStepper,
  COALESCE(raft_sub.display_name, ir.at_fault_sub_type_raw) AS atFaultSubType,
  cp1.first_name AS psngr1FirstName,
  cp1.last_name AS psngr1LastName,
  cp1.date_of_birth AS psngr1DOB,
  cp1.is_minor AS psngr1IsMinor,
  pch1.phone AS psngr1Phone,
  (SELECT COALESCE(ric.carrier_name, li.carrier_raw)
   FROM lead_insurance li
   LEFT JOIN ref_insurance_carrier ric ON ric.id_carrier = li.id_carrier
   WHERE li.id_lead = l.id_lead AND li.insurance_role = 'PASSENGER' AND li.party_sequence = 1
   LIMIT 1) AS psngr1Insurance,
  tx1.display_name AS psngr1TXLoc,
  ps1.appointment_at AS psngr1AppDateTime,
  TRIM(BOTH ',' FROM CONCAT_WS(',',
    (SELECT GROUP_CONCAT(ris.display_name ORDER BY ris.display_name SEPARATOR ',')
     FROM lead_party_injury_site lpis
     INNER JOIN ref_injury_site ris ON ris.id_injury_site = lpis.id_injury_site
     WHERE lpis.id_lead_party = ps1.id_lead_party),
    (SELECT rsl.severity_label FROM ref_severity_level rsl
     WHERE rsl.id_severity = ps1.id_personal_severity LIMIT 1)
  )) AS psngr1Injuries,
  cp2.first_name AS psngr2FirstName,
  cp2.last_name AS psngr2LastName,
  cp2.date_of_birth AS psngr2DOB,
  cp2.is_minor AS psngr2IsMinor,
  pch2.phone AS psngr2Phone,
  (SELECT COALESCE(ric.carrier_name, li.carrier_raw)
   FROM lead_insurance li
   LEFT JOIN ref_insurance_carrier ric ON ric.id_carrier = li.id_carrier
   WHERE li.id_lead = l.id_lead AND li.insurance_role = 'PASSENGER' AND li.party_sequence = 2
   LIMIT 1) AS psngr2Insurance,
  tx2.display_name AS psngr2TXLoc,
  ps2.appointment_at AS psngr2AppDateTime,
  TRIM(BOTH ',' FROM CONCAT_WS(',',
    (SELECT GROUP_CONCAT(ris.display_name ORDER BY ris.display_name SEPARATOR ',')
     FROM lead_party_injury_site lpis
     INNER JOIN ref_injury_site ris ON ris.id_injury_site = lpis.id_injury_site
     WHERE lpis.id_lead_party = ps2.id_lead_party),
    (SELECT rsl.severity_label FROM ref_severity_level rsl
     WHERE rsl.id_severity = ps2.id_personal_severity LIMIT 1)
  )) AS psngr2Injuries,
  cp3.first_name AS psngr3FirstName,
  cp3.last_name AS psngr3LastName,
  cp3.date_of_birth AS psngr3DOB2,
  cp3.is_minor AS psngr3IsMinor,
  pch3.phone AS psngr3Phone,
  (SELECT COALESCE(ric.carrier_name, li.carrier_raw)
   FROM lead_insurance li
   LEFT JOIN ref_insurance_carrier ric ON ric.id_carrier = li.id_carrier
   WHERE li.id_lead = l.id_lead AND li.insurance_role = 'PASSENGER' AND li.party_sequence = 3
   LIMIT 1) AS psngr3Insurance,
  tx3.display_name AS psngr3TXLoc,
  ps3.appointment_at AS psngr3AppDateTime,
  TRIM(BOTH ',' FROM CONCAT_WS(',',
    (SELECT GROUP_CONCAT(ris.display_name ORDER BY ris.display_name SEPARATOR ',')
     FROM lead_party_injury_site lpis
     INNER JOIN ref_injury_site ris ON ris.id_injury_site = lpis.id_injury_site
     WHERE lpis.id_lead_party = ps3.id_lead_party),
    (SELECT rsl.severity_label FROM ref_severity_level rsl
     WHERE rsl.id_severity = ps3.id_personal_severity LIMIT 1)
  )) AS psngr3Injuries,
  cp4.first_name AS psngr4FirstName,
  cp4.last_name AS psngr4LastName,
  cp4.date_of_birth AS psngr4DOB,
  cp4.is_minor AS psngr4IsMinor,
  pch4.phone AS psngr4Phone,
  (SELECT COALESCE(ric.carrier_name, li.carrier_raw)
   FROM lead_insurance li
   LEFT JOIN ref_insurance_carrier ric ON ric.id_carrier = li.id_carrier
   WHERE li.id_lead = l.id_lead AND li.insurance_role = 'PASSENGER' AND li.party_sequence = 4
   LIMIT 1) AS psngr4Insurance,
  tx4.display_name AS psngr4TXLoc,
  ps4.appointment_at AS psngr4AppDateTime,
  TRIM(BOTH ',' FROM CONCAT_WS(',',
    (SELECT GROUP_CONCAT(ris.display_name ORDER BY ris.display_name SEPARATOR ',')
     FROM lead_party_injury_site lpis
     INNER JOIN ref_injury_site ris ON ris.id_injury_site = lpis.id_injury_site
     WHERE lpis.id_lead_party = ps4.id_lead_party),
    (SELECT rsl.severity_label FROM ref_severity_level rsl
     WHERE rsl.id_severity = ps4.id_personal_severity LIMIT 1)
  )) AS psngr4Injuries,
  cp5.first_name AS psngr5FirstName,
  cp5.last_name AS psngr5LastName,
  cp5.date_of_birth AS psngr5DOB,
  cp5.is_minor AS psngr5IsMinor,
  pch5.phone AS psngr5Phone,
  (SELECT COALESCE(ric.carrier_name, li.carrier_raw)
   FROM lead_insurance li
   LEFT JOIN ref_insurance_carrier ric ON ric.id_carrier = li.id_carrier
   WHERE li.id_lead = l.id_lead AND li.insurance_role = 'PASSENGER' AND li.party_sequence = 5
   LIMIT 1) AS psngr5Insurance,
  tx5.display_name AS psngr5TXLoc,
  ps5.appointment_at AS psngr5AppDateTime,
  TRIM(BOTH ',' FROM CONCAT_WS(',',
    (SELECT GROUP_CONCAT(ris.display_name ORDER BY ris.display_name SEPARATOR ',')
     FROM lead_party_injury_site lpis
     INNER JOIN ref_injury_site ris ON ris.id_injury_site = lpis.id_injury_site
     WHERE lpis.id_lead_party = ps5.id_lead_party),
    (SELECT rsl.severity_label FROM ref_severity_level rsl
     WHERE rsl.id_severity = ps5.id_personal_severity LIMIT 1)
  )) AS psngr5Injuries,
  CAST(NULL AS CHAR) AS officeKey,
  l.new_leads AS newLeads,
  CAST(NULL AS CHAR) AS dou,
  CAST(NULL AS CHAR) AS douName,
  sync.corProccesed,
  sync.affProccesed,
  sync.attyProccesed,
  sync.newLeadEmailProccesed,
  sync.lockDownEmailProccesed,
  sync.cameInEmailProccesed,
  sync.droppedEmailProccesed,
  l.id_acc AS idAcc,
  l.id_lead_old AS idLeadOld,
  CAST(NULL AS CHAR) AS `LD Sent`,
  c_inj.display_name AS `Client Name`,
  l.callback_id_new AS cbIDNew,
  l.is_callback_new AS isCallBackNew,
  ll.has_prev_attorney AS hasPrevAtty,
  ll.prev_attorney_name AS prevAttyName,
  ll.is_docusign AS isDocuSigni,
  l.employer,
  la.commercial_policy AS commercialPolicy,
  la.construction,
  la.truck AS Truck,
  ll.is_new_attorney AS isNewAtty,
  l.requested_drop AS requestedDrop

FROM `lead` l
LEFT JOIN lead_org_snapshot org ON org.id_lead = l.id_lead
LEFT JOIN refLeadStatus rls ON rls.idLeadStatus = l.id_lead_status
LEFT JOIN ref_lead_stage stg ON stg.id_stage = l.id_stage
LEFT JOIN lead_legal ll ON ll.id_lead = l.id_lead
LEFT JOIN ref_attorney ra ON ra.id_attorney = ll.id_attorney
LEFT JOIN refLegalStatus rlg ON rlg.idLegalStatus = ll.id_legal_status
LEFT JOIN lead_clinical lc ON lc.id_lead = l.id_lead
LEFT JOIN ref_tx_location rtl ON rtl.id_tx_location = lc.id_tx_location
LEFT JOIN refClinicalStatus rcs ON rcs.idClinicalStatus = lc.id_clinical_status
LEFT JOIN lead_insurance li_pip ON li_pip.id_lead = l.id_lead AND li_pip.insurance_role = 'PIP'
LEFT JOIN ref_insurance_carrier ric_pip ON ric_pip.id_carrier = li_pip.id_carrier
LEFT JOIN lead_insurance li_af ON li_af.id_lead = l.id_lead AND li_af.insurance_role = 'AT_FAULT'
LEFT JOIN ref_insurance_carrier ric_af ON ric_af.id_carrier = li_af.id_carrier
LEFT JOIN lead_accident la ON la.id_lead = l.id_lead
LEFT JOIN ref_accident_location_type ralt ON ralt.id_location_type = la.id_location_type
LEFT JOIN ref_at_fault_type raft ON raft.id_at_fault_type = la.id_at_fault_type
LEFT JOIN ref_at_fault_type raft_sub ON raft_sub.id_at_fault_type = la.id_at_fault_sub_type
LEFT JOIN ref_severity_level rps ON rps.id_severity = la.id_property_severity
LEFT JOIN ref_severity_level ris ON ris.id_severity = la.id_personal_severity
LEFT JOIN ref_state gs_acc ON gs_acc.id_state = la.id_accident_state
LEFT JOIN ref_state gs_rep ON gs_rep.id_state = la.id_rep_state
LEFT JOIN lead_injury li ON li.id_lead = l.id_lead
LEFT JOIN (
  SELECT
    lis.id_lead,
    GROUP_CONCAT(ris.display_name ORDER BY ris.display_name SEPARATOR ',') AS injuries
  FROM lead_injury_site lis
  INNER JOIN ref_injury_site ris ON ris.id_injury_site = lis.id_injury_site
  GROUP BY lis.id_lead
) inj_sites ON inj_sites.id_lead = l.id_lead
LEFT JOIN lead_timeline lt ON lt.id_lead = l.id_lead

LEFT JOIN lead_party lp_inj
  ON lp_inj.id_lead = l.id_lead AND lp_inj.is_primary_party = 1 AND lp_inj.id_party_kind = 1
LEFT JOIN client c_inj ON c_inj.id_client = lp_inj.id_client
LEFT JOIN (
  SELECT
    ca.id_client,
    ca.street,
    ca.unit,
    ca.city,
    gs.state_name,
    ca.postal_code
  FROM client_address ca
  INNER JOIN ref_address_kind ak ON ak.id_address_kind = ca.id_address_kind AND ak.kind_code = 'RESIDENCE'
  LEFT JOIN ref_state gs ON gs.id_state = ca.id_state
  WHERE ca.is_primary = 1 AND ca.is_active = 1
) cl ON cl.id_client = c_inj.id_client

LEFT JOIN (
  SELECT
    cc.id_client,
    MAX(CASE WHEN ct.type_code = 'PHONE_MOBILE' AND cc.is_primary = 1 THEN cc.channel_value END) AS phone,
    MAX(CASE WHEN ct.type_code = 'PHONE_INTAKE_RAW' THEN cc.channel_value END) AS originalPhoneEntry,
    MAX(CASE WHEN ct.type_code = 'PHONE_INTAKE_FORMATTED' THEN cc.channel_value END) AS formattedPhoneEntry,
    MAX(CASE WHEN ct.type_code = 'EMAIL_PERSONAL' AND cc.is_primary = 1 THEN cc.channel_value END) AS email
  FROM client_channel cc
  INNER JOIN ref_contact_channel_type ct ON ct.id_channel_type = cc.id_channel_type
  GROUP BY cc.id_client
) ch ON ch.id_client = c_inj.id_client

LEFT JOIN (
  SELECT
    id_lead,
    MAX(CASE WHEN id_staff_kind = 1 THEN staff_key END) AS staff_key,
    MAX(CASE WHEN id_staff_kind = 1 THEN staff_display_name END) AS staff_display_name
  FROM lead_staff
  WHERE id_staff_kind = 1
  GROUP BY id_lead
) st_sub ON st_sub.id_lead = l.id_lead
LEFT JOIN (
  SELECT
    id_lead,
    MAX(CASE WHEN id_staff_kind = 2 THEN staff_key END) AS staff_key
  FROM lead_staff
  WHERE id_staff_kind = 2
  GROUP BY id_lead
) st_int ON st_int.id_lead = l.id_lead
LEFT JOIN (
  SELECT
    id_lead,
    MAX(CASE WHEN id_staff_kind = 3 THEN staff_key END) AS staff_key
  FROM lead_staff
  WHERE id_staff_kind = 3
  GROUP BY id_lead
) st_cre ON st_cre.id_lead = l.id_lead
LEFT JOIN (
  SELECT
    id_lead,
    MAX(CASE WHEN id_staff_kind = 4 THEN staff_key END) AS staff_key
  FROM lead_staff
  WHERE id_staff_kind = 4
  GROUP BY id_lead
) st_upd ON st_upd.id_lead = l.id_lead
LEFT JOIN app_user u_cre ON u_cre.id_user = l.created_by_user_id
LEFT JOIN app_user u_upd ON u_upd.id_user = l.updated_by_user_id

LEFT JOIN (
  SELECT
    id_lead,
    MAX(CASE WHEN field_name = 'attorney' THEN raw_value END) AS attorney_raw,
    MAX(CASE WHEN field_name = 'tx_location' THEN raw_value END) AS tx_raw,
    MAX(CASE WHEN field_name = 'locationType' THEN raw_value END) AS location_type_raw,
    MAX(CASE WHEN field_name = 'atFaultType' THEN raw_value END) AS at_fault_type_raw,
    MAX(CASE WHEN field_name = 'atFaultSubType' THEN raw_value END) AS at_fault_sub_type_raw,
    MAX(CASE WHEN field_name = 'propertyDamage' THEN raw_value END) AS property_damage_raw,
    MAX(CASE WHEN field_name = 'personalInjury' THEN raw_value END) AS personal_injury_raw
  FROM import_reject
  WHERE field_name IN (
    'attorney', 'tx_location', 'locationType', 'atFaultType', 'atFaultSubType',
    'propertyDamage', 'personalInjury'
  )
  GROUP BY id_lead
) ir ON ir.id_lead = l.id_lead

LEFT JOIN (
  SELECT
    id_lead,
    MAX(CASE WHEN flag_code = 'COR' THEN flag_value END) AS corProccesed,
    MAX(CASE WHEN flag_code = 'AFF' THEN flag_value END) AS affProccesed,
    MAX(CASE WHEN flag_code = 'ATTY' THEN flag_value END) AS attyProccesed,
    MAX(CASE WHEN flag_code = 'NEW_LEAD_EMAIL' THEN flag_value END) AS newLeadEmailProccesed,
    MAX(CASE WHEN flag_code = 'LOCKDOWN_EMAIL' THEN flag_value END) AS lockDownEmailProccesed,
    MAX(CASE WHEN flag_code = 'CAME_IN_EMAIL' THEN flag_value END) AS cameInEmailProccesed,
    MAX(CASE WHEN flag_code = 'DROPPED_EMAIL' THEN flag_value END) AS droppedEmailProccesed
  FROM lead_sync_flag
  GROUP BY id_lead
) sync ON sync.id_lead = l.id_lead

LEFT JOIN (
  SELECT
    id_lead,
    MAX(CASE WHEN note_type = 'intake' THEN body END) AS leadNotes,
    MAX(CASE WHEN note_type = 'accident' THEN body END) AS accidentNotes,
    MAX(CASE WHEN note_type = 'hospital' THEN body END) AS hospitalNotes
  FROM lead_note
  GROUP BY id_lead
) notes ON notes.id_lead = l.id_lead

LEFT JOIN (
  SELECT
    id_lead,
    MAX(COALESCE(updated_at, posted_at)) AS max_note_at
  FROM lead_note
  GROUP BY id_lead
) notes_meta ON notes_meta.id_lead = l.id_lead

LEFT JOIN (
  SELECT
    id_lead,
    MAX(changed_at) AS max_event_at
  FROM lead_status_event
  GROUP BY id_lead
) evt_meta ON evt_meta.id_lead = l.id_lead

LEFT JOIN lead_party ps1 ON ps1.id_lead = l.id_lead AND ps1.id_party_kind = 2 AND ps1.party_sequence = 1
LEFT JOIN client cp1 ON cp1.id_client = ps1.id_client
LEFT JOIN ref_tx_location tx1 ON tx1.id_tx_location = ps1.id_tx_location
LEFT JOIN (
  SELECT cc.id_client, MAX(cc.channel_value) AS phone
  FROM client_channel cc
  INNER JOIN ref_contact_channel_type ct ON ct.id_channel_type = cc.id_channel_type
  WHERE ct.medium_code = 'PHONE' AND cc.is_primary = 1
  GROUP BY cc.id_client
) pch1 ON pch1.id_client = cp1.id_client

LEFT JOIN lead_party ps2 ON ps2.id_lead = l.id_lead AND ps2.id_party_kind = 2 AND ps2.party_sequence = 2
LEFT JOIN client cp2 ON cp2.id_client = ps2.id_client
LEFT JOIN ref_tx_location tx2 ON tx2.id_tx_location = ps2.id_tx_location
LEFT JOIN (
  SELECT cc.id_client, MAX(cc.channel_value) AS phone
  FROM client_channel cc
  INNER JOIN ref_contact_channel_type ct ON ct.id_channel_type = cc.id_channel_type
  WHERE ct.medium_code = 'PHONE' AND cc.is_primary = 1
  GROUP BY cc.id_client
) pch2 ON pch2.id_client = cp2.id_client

LEFT JOIN lead_party ps3 ON ps3.id_lead = l.id_lead AND ps3.id_party_kind = 2 AND ps3.party_sequence = 3
LEFT JOIN client cp3 ON cp3.id_client = ps3.id_client
LEFT JOIN ref_tx_location tx3 ON tx3.id_tx_location = ps3.id_tx_location
LEFT JOIN (
  SELECT cc.id_client, MAX(cc.channel_value) AS phone
  FROM client_channel cc
  INNER JOIN ref_contact_channel_type ct ON ct.id_channel_type = cc.id_channel_type
  WHERE ct.medium_code = 'PHONE' AND cc.is_primary = 1
  GROUP BY cc.id_client
) pch3 ON pch3.id_client = cp3.id_client

LEFT JOIN lead_party ps4 ON ps4.id_lead = l.id_lead AND ps4.id_party_kind = 2 AND ps4.party_sequence = 4
LEFT JOIN client cp4 ON cp4.id_client = ps4.id_client
LEFT JOIN ref_tx_location tx4 ON tx4.id_tx_location = ps4.id_tx_location
LEFT JOIN (
  SELECT cc.id_client, MAX(cc.channel_value) AS phone
  FROM client_channel cc
  INNER JOIN ref_contact_channel_type ct ON ct.id_channel_type = cc.id_channel_type
  WHERE ct.medium_code = 'PHONE' AND cc.is_primary = 1
  GROUP BY cc.id_client
) pch4 ON pch4.id_client = cp4.id_client

LEFT JOIN lead_party ps5 ON ps5.id_lead = l.id_lead AND ps5.id_party_kind = 2 AND ps5.party_sequence = 5
LEFT JOIN client cp5 ON cp5.id_client = ps5.id_client
LEFT JOIN ref_tx_location tx5 ON tx5.id_tx_location = ps5.id_tx_location
LEFT JOIN (
  SELECT cc.id_client, MAX(cc.channel_value) AS phone
  FROM client_channel cc
  INNER JOIN ref_contact_channel_type ct ON ct.id_channel_type = cc.id_channel_type
  WHERE ct.medium_code = 'PHONE' AND cc.is_primary = 1
  GROUP BY cc.id_client
) pch5 ON pch5.id_client = cp5.id_client;

-- Nombre legacy que usa etl_table_config.srcTable = 'tblLeads'
CREATE VIEW tblLeads AS
SELECT * FROM v_tblLeads;
