-- =============================================================================
-- Vistas compat ETL (nombres legacy = etl_table_config.srcTable)
-- Destino de reportes no cambia: ETL sigue llenando stg_* → SPs → dm*
-- Aplicar: npm run apply-views
-- =============================================================================

-- ---------------------------------------------------------------------------
-- g_users ← app_user + hierarchy_membership + catálogos
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS g_users;
CREATE VIEW g_users AS
SELECT
  u.id_user AS id,
  u.legacy_row_id AS rowId,
  u.display_name AS name,
  CAST(NULL AS CHAR) AS nick,
  u.phone,
  u.email,
  u.picture,
  uc_fb.channel_value AS fbHandle,
  uc_ig.channel_value AS igHandle,
  jt.job_title_name AS title,
  rk.rank_name AS `rank`,
  dept.department_name AS systemDepartment,
  u.access_level AS systemAccessLevel,
  CAST(NULL AS CHAR) AS systemKeyLeadLinker,
  h.hierarchyDuo,
  h.hierarchyTeam,
  h.hierarchyPod,
  h.hierarchyOffice,
  h.hierarchyRegion,
  h.hierarchyDirectorate,
  CAST(NULL AS CHAR) AS hierarchySpecialAccessZc,
  CAST(NULL AS CHAR) AS hierarchySpecialAccessCd,
  u.hr_status AS hrStatus,
  u.hired_at AS hrHired,
  u.termed_at AS hrTermed,
  u.hr_budget AS hrBudget,
  u.hr_deal_amount AS hrDealAmount,
  u.hr_deal_goal AS hrDealGoal,
  u.hr_ee_type AS hrEeType,
  CAST(NULL AS SIGNED) AS tglIntakePanel,
  CAST(NULL AS CHAR) AS selectDay,
  CAST(NULL AS CHAR) AS selectIntaker,
  CAST(NULL AS CHAR) AS cbLeadId,
  CAST(NULL AS CHAR) AS cbLeadName,
  CAST(NULL AS CHAR) AS cbLeadPhone,
  o.office_code AS office,
  so.sub_office_code AS SubOffice,
  CAST(NULL AS SIGNED) AS parametersViewIsConfirmed,
  CAST(NULL AS CHAR) AS dubCheck1,
  CAST(NULL AS CHAR) AS parametersHomeList,
  CAST(NULL AS CHAR) AS mediaIdMedia,
  CAST(NULL AS CHAR) AS editPanelTgtLead,
  CAST(NULL AS CHAR) AS bookingFormLeadIdSelected,
  CAST(NULL AS SIGNED) AS bookingFormShowLeads,
  CAST(NULL AS CHAR) AS chatChattingTo,
  CAST(NULL AS CHAR) AS cbId,
  CAST(NULL AS SIGNED) AS cbTriggered,
  CAST(NULL AS SIGNED) AS isHotLeadTriggered,
  CAST(NULL AS SIGNED) AS intakePanelIntakePanelStepper,
  CAST(NULL AS SIGNED) AS intakePanelViewIntakeSection,
  CAST(NULL AS SIGNED) AS intakePanelViewDemoSection,
  CAST(NULL AS SIGNED) AS intakePanelViewInsuranceSection,
  CAST(NULL AS SIGNED) AS intakePanelViewTxSection,
  CAST(NULL AS SIGNED) AS intakePanelViewAttySection,
  CAST(NULL AS SIGNED) AS intakePanelViewInjAndDamSection,
  CAST(NULL AS SIGNED) AS intakePanelViewQuestionnaireSection,
  CAST(NULL AS SIGNED) AS intakePanelViewPsngrSection,
  CAST(NULL AS CHAR) AS tmpTgtForLdButton,
  CAST(NULL AS CHAR) AS dumbAi,
  u.dob,
  u.individual_log_url AS logsIndividualFile,
  u.roster_file_url AS rosterIndividualFile,
  u.management_pay AS managementPay,
  u.boost_budget AS boostBudget,
  CAST(NULL AS SIGNED) AS profileShowRole,
  CAST(NULL AS SIGNED) AS profileShowHr,
  CAST(NULL AS SIGNED) AS profileShowComp,
  CAST(NULL AS SIGNED) AS showActiveLeadDb,
  CAST(NULL AS CHAR) AS profileDbSelector,
  CAST(NULL AS SIGNED) AS homescreenLoadingNlToday,
  CAST(NULL AS SIGNED) AS chartsShowVisuals1,
  CAST(NULL AS SIGNED) AS chartsHideVisuals1,
  CAST(NULL AS SIGNED) AS chartsShowVisuals2,
  CAST(NULL AS SIGNED) AS chartsHideVisuals2,
  CAST(NULL AS SIGNED) AS chartsShowVisuals3,
  CAST(NULL AS SIGNED) AS chartsHideVisuals3,
  CAST(NULL AS SIGNED) AS chartsShowVisuals4,
  CAST(NULL AS SIGNED) AS chartsHideVisuals4,
  CAST(NULL AS SIGNED) AS scheduleListShowIntakeList,
  CAST(NULL AS SIGNED) AS scheduleListHideIntakeList,
  u.hr_deal_goal AS DealGoal,
  u.paylocity_id AS paylocityId,
  u.hr_deal_goal_custom AS DealGoalCustom,
  u.machine_file_url AS machineIndividual,
  u.lead_sheet_url AS leadSheetURL,
  u.individual_lead_sheet_url AS individualLeadSheetURL,
  CAST(NULL AS CHAR) AS shift,
  COALESCE(u.synced_at, CAST('1970-01-01' AS DATETIME)) AS row_changed_at,
  CAST(NULL AS SIGNED) AS `agreedtoT&C`,
  CAST(NULL AS DATETIME) AS `T&CTimestamp`,
  CAST(NULL AS SIGNED) AS `signedtoT&C`,
  CAST(NULL AS CHAR) AS rosterlastmonthFile,
  CAST(NULL AS CHAR) AS Address
FROM app_user u
LEFT JOIN ref_job_title jt ON jt.job_title_id = u.id_job_title
LEFT JOIN ref_rank rk ON rk.rank_id = u.id_rank
LEFT JOIN ref_department dept ON dept.department_id = u.id_department
LEFT JOIN ref_company_office o ON o.id_company_office = u.id_company_office
LEFT JOIN ref_sub_office so ON so.id_sub_office = u.id_sub_office
LEFT JOIN (
  SELECT
    hm.user_id,
    MAX(CASE WHEN hl.level_code = 'DUO' THEN lu.email END) AS hierarchyDuo,
    MAX(CASE WHEN hl.level_code = 'TEAM' THEN lu.email END) AS hierarchyTeam,
    MAX(CASE WHEN hl.level_code = 'POD' THEN lu.email END) AS hierarchyPod,
    MAX(CASE WHEN hl.level_code = 'OFFICE' THEN lu.email END) AS hierarchyOffice,
    MAX(CASE WHEN hl.level_code = 'REGION' THEN lu.email END) AS hierarchyRegion,
    MAX(CASE WHEN hl.level_code = 'DIRECTORATE' THEN lu.email END) AS hierarchyDirectorate
  FROM hierarchy_membership hm
  INNER JOIN hierarchy_level hl ON hl.id_hierarchy_level = hm.id_hierarchy_level
  LEFT JOIN app_user lu ON lu.id_user = hm.leader_user_id
  WHERE hm.is_active = 1
    AND (hm.end_date IS NULL OR hm.end_date >= CURDATE())
  GROUP BY hm.user_id
) h ON h.user_id = u.id_user
LEFT JOIN (
  SELECT uc.id_user, MAX(uc.channel_value) AS channel_value
  FROM user_channel uc
  INNER JOIN ref_contact_channel_type ct ON ct.id_channel_type = uc.id_channel_type
  WHERE ct.type_code = 'SOCIAL_FACEBOOK' AND uc.is_active = 1
  GROUP BY uc.id_user
) uc_fb ON uc_fb.id_user = u.id_user
LEFT JOIN (
  SELECT uc.id_user, MAX(uc.channel_value) AS channel_value
  FROM user_channel uc
  INNER JOIN ref_contact_channel_type ct ON ct.id_channel_type = uc.id_channel_type
  WHERE ct.type_code = 'SOCIAL_INSTAGRAM' AND uc.is_active = 1
  GROUP BY uc.id_user
) uc_ig ON uc_ig.id_user = u.id_user;

-- ---------------------------------------------------------------------------
-- refAttorneys ← ref_attorney
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS refAttorneys;
CREATE VIEW refAttorneys AS
SELECT
  a.id_attorney AS idAttorney,
  a.display_name AS attorney,
  a.firm_name AS firm,
  a.contract_group AS contractGroup,
  a.email_subject_prefix AS emailSubjectPrefix,
  a.ext_email_targets AS extEmailTargets,
  a.internal_source AS internalSource,
  CASE WHEN a.is_active = 1 THEN 'ACTIVE' ELSE 'INACTIVE' END AS status,
  st.state_name AS states,
  a.is_emails_enabled AS emails,
  a.is_emails_ld_enabled AS emailsLD,
  a.is_misc AS miscellaneous,
  a.is_standard AS standardAtty,
  a.is_active_on_portal AS activeOnPortal,
  COALESCE(a.updated_at, a.synced_at, CAST('1970-01-01' AS DATETIME)) AS row_changed_at
FROM ref_attorney a
LEFT JOIN ref_state st ON st.id_state = a.id_state;

-- ---------------------------------------------------------------------------
-- SpecialList ← ref_special_list
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS SpecialList;
CREATE VIEW SpecialList AS
SELECT
  COALESCE(s.legacy_id, s.lead_key, CAST(s.id_special_list AS CHAR)) AS ID,
  s.status_code AS STATUS,
  s.notes AS COMMENTS,
  s.created_at AS CreatedAt,
  COALESCE(s.updated_at, s.created_at, CAST('1970-01-01' AS DATETIME)) AS row_changed_at
FROM ref_special_list s;

-- ---------------------------------------------------------------------------
-- tblCompanyOffices ← ref_company_office
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS tblCompanyOffices;
CREATE VIEW tblCompanyOffices AS
SELECT
  o.id_company_office AS idCompanyOffice,
  o.id_company AS idCompany,
  o.office_code AS officeName,
  o.display_name AS description,
  o.capacity,
  COALESCE(o.synced_at, CAST('1970-01-01' AS DATETIME)) AS row_changed_at
FROM ref_company_office o;

-- ---------------------------------------------------------------------------
-- tblLeadComments ← lead_note (note_type = comment)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS tblLeadComments;
CREATE VIEW tblLeadComments AS
SELECT
  n.id_note AS idComment,
  n.id_lead AS IdLead,
  n.body AS comment,
  n.posted_at AS posted,
  n.posted_by AS postedBy
FROM lead_note n
WHERE n.note_type = 'comment';

-- ---------------------------------------------------------------------------
-- tblLeadsDataLegalClinicalStatus ← snapshot vigente legal/clinical
-- (prod es tabla upserted; aquí reflejamos estado actual + row_changed_at)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS tblLeadsDataLegalClinicalStatus;
CREATE VIEW tblLeadsDataLegalClinicalStatus AS
SELECT
  l.id_lead AS Id,
  l.id_lead AS IdLead,
  CAST(l.id_lead AS CHAR) AS IdLeadStr,
  l.id_lead_old AS IdLeadOld,
  COALESCE(ra.display_name, ir.attorney_raw) AS Attorney,
  COALESCE(rtl.display_name, ir.tx_raw) AS TxLocation,
  rcs.clinicalStatus AS ClinicalStatus,
  rlg.legalStatus AS LegalStatus,
  lc.idot AS IDOT,
  lc.ldot AS LDOT,
  l.cnv_value AS convertedValue,
  lc.visits AS Visits,
  COALESCE(l.created_at, CAST('1970-01-01' AS DATETIME)) AS CreatedAt,
  COALESCE(
    GREATEST(
      COALESCE(ll.updated_at, CAST('1970-01-01' AS DATETIME)),
      COALESCE(lc.updated_at, CAST('1970-01-01' AS DATETIME)),
      COALESCE(l.updated_at, CAST('1970-01-01' AS DATETIME))
    ),
    CAST('1970-01-01' AS DATETIME)
  ) AS row_changed_at,
  COALESCE(ra.is_misc, 0) AS isMiscellaneous
FROM `lead` l
LEFT JOIN lead_legal ll ON ll.id_lead = l.id_lead
LEFT JOIN lead_clinical lc ON lc.id_lead = l.id_lead
LEFT JOIN ref_attorney ra ON ra.id_attorney = ll.id_attorney
LEFT JOIN ref_tx_location rtl ON rtl.id_tx_location = lc.id_tx_location
LEFT JOIN refLegalStatus rlg ON rlg.idLegalStatus = ll.id_legal_status
LEFT JOIN refClinicalStatus rcs ON rcs.idClinicalStatus = lc.id_clinical_status
LEFT JOIN (
  SELECT
    id_lead,
    MAX(CASE WHEN field_name = 'attorney' THEN raw_value END) AS attorney_raw,
    MAX(CASE WHEN field_name = 'tx_location' THEN raw_value END) AS tx_raw
  FROM import_reject
  WHERE field_name IN ('attorney', 'tx_location')
  GROUP BY id_lead
) ir ON ir.id_lead = l.id_lead;

-- ---------------------------------------------------------------------------
-- tblLeadsLogsStatus ← lead_status_event (dominio LEAD)
-- Aproxima LogStatus legacy (ACTIVE/DROPPED/PROBLEM). REF OUT no es 1:1.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS tblLeadsLogsStatus;
CREATE VIEW tblLeadsLogsStatus AS
SELECT
  e.event_id AS Id,
  e.id_lead AS IdLead,
  l.id_lead_old AS IdLeadOld,
  CASE
    WHEN rls.leadStatus = 'Dropped' THEN 'DROPPED'
    WHEN rls.leadStatus = 'Problem' THEN 'PROBLEM'
    WHEN rls.leadStatus IN ('Came In', 'Came in - unverified', 'Locked Down', 'New Lead', 'Call Back', 'Pending', 'Rescheduled', 'No Show', 'CNA')
      THEN 'ACTIVE'
    ELSE COALESCE(UPPER(rls.leadStatus), 'ACTIVE')
  END AS LogStatus,
  e.changed_at AS CreatedAt,
  COALESCE(e.changed_at, e.created_at, CAST('1970-01-01' AS DATETIME)) AS row_changed_at
FROM lead_status_event e
INNER JOIN `lead` l ON l.id_lead = e.id_lead
LEFT JOIN refLeadStatus rls ON rls.idLeadStatus = e.id_status_to
WHERE e.status_domain = 'LEAD';

-- ---------------------------------------------------------------------------
-- vIntakeSpecialistTestFilterDashboard — lista estática de emails de prueba
-- (prod: UNION fijo). ETL → stg_*; SPs dmLeadsNew / roster user excluyen estos.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS vIntakeSpecialistTestFilterDashboard;
CREATE VIEW vIntakeSpecialistTestFilterDashboard AS
SELECT email FROM (
  SELECT 'aarboleda@305nofault.com' AS email
  UNION ALL SELECT 'creyes@305nofault.com'
  UNION ALL SELECT 'jwazar@305nofault.com'
  UNION ALL SELECT 'mpomares@305nofault.com'
  UNION ALL SELECT 'reptnfg4@gmail.com'
  UNION ALL SELECT 'ccajin@305nofault.com'
  UNION ALL SELECT 'christiand@305nofault.com'
  UNION ALL SELECT 'miodrag.zivanovic@toptal.com'
  UNION ALL SELECT 'mruiz@305nofault.com'
) t1;
