-- Reconstrucción g_users desde app_user (NO usar si ya copiaste la tabla de Glide).
-- La copia 1:1 es: npm run copy:g-users
-- Este archivo queda por si hay que volver a la vista.

DROP VIEW IF EXISTS g_users;
CREATE VIEW g_users AS
SELECT
  u.id_user AS id,
  u.legacy_row_id AS rowId,
  u.display_name AS name,
  u.nick,
  u.phone,
  u.email,
  u.picture,
  uc_fb.channel_value AS fbHandle,
  uc_ig.channel_value AS igHandle,
  jt.job_title_name AS title,
  rk.rank_name AS `rank`,
  dept.department_name AS systemDepartment,
  u.access_level AS systemAccessLevel,
  u.system_key_lead_linker AS systemKeyLeadLinker,
  h.hierarchyDuo,
  h.hierarchyTeam,
  h.hierarchyPod,
  h.hierarchyOffice,
  h.hierarchyRegion,
  h.hierarchyDirectorate,
  u.hierarchy_special_access_zc AS hierarchySpecialAccessZc,
  u.hierarchy_special_access_cd AS hierarchySpecialAccessCd,
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
  u.media_id_media AS mediaIdMedia,
  CAST(NULL AS CHAR) AS editPanelTgtLead,
  CAST(NULL AS CHAR) AS bookingFormLeadIdSelected,
  CAST(NULL AS SIGNED) AS bookingFormShowLeads,
  CAST(NULL AS CHAR) AS chatChattingTo,
  CAST(NULL AS CHAR) AS cbId,
  CAST(NULL AS SIGNED) AS cbTriggered,
  CAST(NULL AS SIGNED) AS isHotLeadTriggered,
  u.intake_panel_stepper AS intakePanelIntakePanelStepper,
  u.intake_panel_view_intake AS intakePanelViewIntakeSection,
  u.intake_panel_view_demo AS intakePanelViewDemoSection,
  u.intake_panel_view_insurance AS intakePanelViewInsuranceSection,
  u.intake_panel_view_tx AS intakePanelViewTxSection,
  u.intake_panel_view_atty AS intakePanelViewAttySection,
  u.intake_panel_view_inj_and_dam AS intakePanelViewInjAndDamSection,
  u.intake_panel_view_questionnaire AS intakePanelViewQuestionnaireSection,
  u.intake_panel_view_psngr AS intakePanelViewPsngrSection,
  CAST(NULL AS CHAR) AS tmpTgtForLdButton,
  CAST(NULL AS CHAR) AS dumbAi,
  u.dob,
  u.individual_log_url AS logsIndividualFile,
  u.roster_file_url AS rosterIndividualFile,
  u.roster_last_month_file_url AS rosterlastmonthFile,
  u.management_pay AS managementPay,
  u.boost_budget AS boostBudget,
  u.profile_show_role AS profileShowRole,
  u.profile_show_hr AS profileShowHr,
  u.profile_show_comp AS profileShowComp,
  CAST(NULL AS SIGNED) AS showActiveLeadDb,
  CAST(NULL AS CHAR) AS profileDbSelector,
  CAST(NULL AS SIGNED) AS homescreenLoadingNlToday,
  u.charts_show_visuals_1 AS chartsShowVisuals1,
  u.charts_hide_visuals_1 AS chartsHideVisuals1,
  u.charts_show_visuals_2 AS chartsShowVisuals2,
  u.charts_hide_visuals_2 AS chartsHideVisuals2,
  u.charts_show_visuals_3 AS chartsShowVisuals3,
  u.charts_hide_visuals_3 AS chartsHideVisuals3,
  u.charts_show_visuals_4 AS chartsShowVisuals4,
  u.charts_hide_visuals_4 AS chartsHideVisuals4,
  CAST(NULL AS SIGNED) AS scheduleListShowIntakeList,
  CAST(NULL AS SIGNED) AS scheduleListHideIntakeList,
  u.hr_deal_goal AS DealGoal,
  u.paylocity_id AS paylocityId,
  u.hr_deal_goal_custom AS DealGoalCustom,
  u.machine_file_url AS machineIndividual,
  u.lead_sheet_url AS leadSheetURL,
  u.individual_lead_sheet_url AS individualLeadSheetURL,
  u.shift AS shift,
  COALESCE(u.synced_at, CAST('1970-01-01' AS DATETIME)) AS row_changed_at,
  u.agreed_to_tc AS `agreedtoT&C`,
  u.tc_agreed_at AS `T&CTimestamp`,
  u.signed_to_tc AS `signedtoT&C`,
  u.address AS Address,
  u.referred_by AS Referred_By
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
