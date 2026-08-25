/**
 * Detalle antes/después + contrato request/response por endpoint.
 * Clave: `${blockId}|${method}|${path}`
 */

const AUTH = 'Header: Authorization: Bearer <JWT>';

const PAGED_LIST = `{
  data: [...],
  page: number,
  pageSize: number,
  total: number,
  order: "ASC" | "DESC",
  meta: { page, limit, itemCount, pageCount, hasPreviousPage, hasNextPage }
}`;

const LEAD_LIST_ITEM = `{
  idLead, name, submitter, submitterName,
  formattedPhoneEntry, leadStatus, created, rescheFlg
}`;

function d(before, now, request, response) {
  return { beforeDetail: before, nowDetail: now, request, response };
}

const ENDPOINT_DETAILS = {
  'user-management|GET|user-list': d(
    'case-service → dbProduction.g_users. Paginación page/limit/search.',
    'intake-api → TNFG_INTAKE.app_user + JOIN ref_rank, ref_job_title, ref_department.',
    `Query: page?, limit?, order?, name?, hrStatus?
${AUTH}`,
    PAGED_LIST.replace('[...]', 'UserGridRow[] (id, name, email, rank, title, department, status, …)'),
  ),
  'user-management|GET|user/:user_id': d(
    'case-service: g_users + jerarquía (hierarchyTeam) por user_id.',
    'intake-api: app_user + hierarchy_membership + user_channel + catálogos FK; BD: hr_deal_goal (DealGoal), hr_deal_goal_custom, paylocity_id.',
    `Path: user_id (number)
${AUTH}`,
    `UserDetail {
  userId, name, email, phone, rank, title, department,
  team, accessLevel, dateHired, picture, igHandle, fbHandle,
  hierarchyTeam, hierarchyPod, hierarchyRegion, …
}`,
  ),
  'user-management|GET|teams': d(
    'case-service: g_users ∩ hierarchyTeam para dropdown Create User.',
    'intake-api: app_user activos con hierarchy_membership (team leaders).',
    `${AUTH}`,
    `[{ userId, name, email, teamName, … }]`,
  ),
  'user-management|GET|departments': d(
    'case-service: departments / DISTINCT systemDepartment.',
    'intake-api: ref_department.',
    `${AUTH}`,
    `[{ id, name }] o { data: [{ id, name }] }`,
  ),
  'user-management|GET|ranks': d(
    'case-service: ranks en dbProduction.',
    'intake-api: ref_rank.',
    `${AUTH}`,
    `[{ id, name }]`,
  ),
  'user-management|GET|job-titles': d(
    'case-service: DISTINCT g_users.title.',
    'intake-api: ref_job_title.',
    `${AUTH}`,
    `[{ id, name }]`,
  ),
  'user-management|GET|contract-types': d(
    'case-service: contractType texto en g_users.',
    'intake-api: ref_ee_contract_type.',
    `${AUTH}`,
    `[{ id, name }]`,
  ),
  'user-management|GET|hr-statuses': d(
    'case-service: hrStatus texto (Active, Termed…).',
    'intake-api: ref_hr_status (portal seed).',
    `${AUTH}`,
    `[{ id, code, name }] o { data: [{ statusCode, displayName }] }`,
  ),
  'user-management|GET|intake-roles': d(
    'case-service: —.',
    'intake-api: roles INTAKE desde SECURITY (admin grants).',
    `${AUTH}`,
    `[{ roleCode, displayName }]`,
  ),
  'user-management|POST|user': d(
    'case-service: Glide + sp_insert_user → g_users.',
    'intake-api: INSERT app_user + security provision (persona).',
    `Body: {
  name, email, phoneNumber, team, department, title,
  accessLevel, dateHired, dateofbirt?, deal, budget,
  contractType, igHandle?, fbHandle?, rank?
}
${AUTH}`,
    `{ success: true, id: number, glideRowId: string }
409 si email duplicado`,
  ),
  'user-management|PUT|user': d(
    'case-service: sp_update_user (HR). UI Portal pendiente.',
    'intake-api: UPDATE app_user + FKs.',
    `Body: { userId, …mismos campos que POST user }
${AUTH}`,
    `{ success: true }`,
  ),
  'user-management|PUT|user-information': d(
    'case-service: UPDATE g_users picture/redes.',
    'intake-api: UPDATE app_user + user_channel.',
    `Body: { userId, picture?, igHandle?, fbHandle?, userTimeZone? }
${AUTH}`,
    `{ success: true }`,
  ),

  'user-management|POST|user/:user_id/term': d(
    'case-service: — (HR term).',
    'intake-api: app_user hrStatus=termed + user_hr_period.',
    `Path: user_id (number)
${AUTH}`,
    `{ success: true }`,
  ),
  'user-management|POST|rehire': d(
    'case-service: rehire flow HR.',
    'intake-api: app_user Active + nuevo período user_hr_period.',
    `Body: { userId: number, rehireDate: "YYYY-MM-DD" }
${AUTH}`,
    `{ success: true, … }`,
  ),
  'user-management|POST|offboard': d(
    'case-service: offboard flow HR.',
    'intake-api: app_user Termed + cierre user_hr_period.',
    `Body: { userId: number, offboardDate: "YYYY-MM-DD" }
${AUTH}`,
    `{ success: true, … }`,
  ),
  'user-management|POST|orientation-change': d(
    'case-service: change hierarchyTeam / leader.',
    'intake-api: hierarchy_membership (team leader).',
    `Body: { userId: number, teamLeaderId: number }
${AUTH}`,
    `{ success: true, … }`,
  ),

  'directory|GET|departments': d(
    'case-service: DISTINCT systemDepartment desde g_users.',
    'intake-api: DISTINCT ref_department vía app_user.',
    `${AUTH}`,
    `[{ departmentName, userCount? }]`,
  ),
  'directory|GET|user-list': d(
    'case-service: g_users + catálogos + jerarquía.',
    'intake-api: app_user + JOINs TNFG.',
    `Query: page?, limit?, order?, statusFilter?, department?, name?
${AUTH}`,
    PAGED_LIST.replace('[...]', 'DirectoryUserRow[]'),
  ),

  'case-manager|GET|active-leads/count': d(
    'case-service: COUNT tblLeads New Lead + scope jerarquía.',
    'intake-api: COUNT lead + refLeadStatus + membership scope.',
    `${AUTH}
Scope: admin = todos; no-admin = jerarquía del JWT`,
    `{ total: number }`,
  ),
  'case-manager|GET|leads': d(
    'case-service: tblLeads por leadStatus (+ period opc.).',
    'intake-api: lead JOIN client, status, submitter.',
    `Query: leadStatus (requerido), period?, periodValue?,
       search?, page?, limit?, order?
${AUTH}`,
    PAGED_LIST.replace('[...]', LEAD_LIST_ITEM),
  ),
  'case-manager|GET|leads/:idLead': d(
    'case-service: wide row tblLeads.',
    'intake-api: lead + dominios TNFG → mapLeadDetailToPortalResponse (JSON plano Portal).',
    `Path: idLead (number)
${AUTH}`,
    `LeadDetail (flat Portal) {
  idLead, name, submitter, submitterName, formattedPhoneEntry,
  leadStatus, created, teamName, office, officeName,
  doa, accidentOrWC, accidentState, atFaultType, isMinor, dob,
  phone, originalPhoneEntry, email, street, city, residencyState, zipCode,
  preferredLanguage, pipInsurance, atfaultInsurance, hasUM, vehicleModelYear,
  txLocation, requiresTransportation, isTeleMedicine, attorney,
  hasPrevAtty, policeReport, isDocuSigni, signingDate, employer,
  propertyDamage, personalInjury, injuries (string CSV),
  ticketAttorney, drivingRideShare, psgInRideShare, fracture, ambulance,
  xray, mri, ctScans, hospital, commercialPolicy, construction, truck,
  passengerCount, appointmentDateTime, accidentNotes, …
}`,
  ),
  'case-manager|POST|leads': d(
    'case-service: INSERT tblLeads AUTO_INCREMENT.',
    'intake-api: transacción multi-tabla TNFG (incluye INSERT lead_org_snapshot desde submitter; opcional tblLeadConflictCase si conflictLeadId).',
    `Body: {
  phone, firstName, lastName, clientState, accidentState,
  isBoostedLead: "yes"|"no", source?, passengers?, languages?,
  notes?, isHotLead?, conflictLeadId?,
  attachments?: [{ documentId, fileName }]
}
${AUTH}`,
    `{ idLead: number }`,
  ),
  'case-manager|GET|leads/phone-conflict': d(
    'case-service / portal: valida teléfono duplicado en ventana reciente.',
    'intake-api: client_channel (phone digits) + lead created_at últimos 15 días, status != Dropped; isBlocking si Came In o Locked Down.',
    `Query: phone (digits o formateado; se normaliza a 10 dígitos)
${AUTH}`,
    `{
  hasConflict: boolean,
  isBlocking: boolean,
  conflictLead?: {
    idLead, name, submitterName, officeName, created, leadStatus
  }
}`,
  ),
  'case-manager|GET|leads/:idLead/conflict-case': d(
    'case-service: tblLeadConflictCase (grupo / maestro).',
    'intake-api: tblLeadConflictCase + lead + refLeadStatus (grupo por idMaestro).',
    `Path: idLead (number)
${AUTH}`,
    `{
  isInConflict: boolean,
  idMaestro: number | null,
  isFirstLead: boolean,
  firstLeadStatus: string | null,
  firstLeadCreatedAt: string | null,
  conflictLeads: [{ idLead, leadStatus, createdAt, isFirstLead }]
}`,
  ),
  'case-manager|PATCH|leads/:idLead': d(
    'Edit Lead Save — case-service no tenía PATCH; intake-api v1 usaba DTO anidado.',
    'intake-api: JSON plano Portal (UpdateLeadDto) → update-lead-portal.mapper → tablas TNFG + entity_log.',
    `Path: idLead (number)
Body (parcial, flat UpdateLeadDto — mismos nombres que GET):
{
  leadStatus?, doa?, accidentOrWC?, accidentState?, atFaultType?,
  isMinor?, dob?, firstName?, lastName?, phone?, formattedPhoneEntry?,
  originalPhoneEntry?, email?, street?, city?, residencyState?, zipCode?,
  preferredLanguage?, pipInsurance?, atfaultInsurance?, hasUM?,
  vehicleModelYear?, txLocation?, requiresTransportation?, isTeleMedicine?,
  attorney?, hasPrevAtty?, policeReport?, isDocuSigni?, signingDate?,
  employer?, propertyDamage?, personalInjury?, injuries? (CSV string),
  ticketAttorney?, drivingRideShare?, psgInRideShare?, fracture?,
  ambulance?, xray?, mri?, ctScans?, hospital?, commercialPolicy?,
  construction?, truck?, passengerCount?, appointmentDateTime?,
  accidentNotes?, psngr1* … psngr4* (passengers)
}
${AUTH}`,
    `{ success: true }`,
  ),
  'case-manager|PATCH|leads/:idLead/accident-notes': d(
    'case-service: UPDATE tblLeads.accidentNotes.',
    'intake-api: UPSERT lead_note accident.',
    `Path: idLead
Body: { accidentNotes: string | null }
${AUTH}`,
    `{ success: true }`,
  ),
  'case-manager|POST|leads/:idLead/transfer': d(
    'case-service: UPDATE submitter en tblLeads.',
    'intake-api: UPDATE submitter_user_id + REPLACE lead_staff SUBMITTER + UPDATE lead_org_snapshot (team/office/region/pod del nuevo rep).',
    `Path: idLead
Body: { userId: number }
${AUTH}`,
    `{ success: true }`,
  ),
  'case-manager|GET|search-leads': d(
    'Portal MF intake: combobox Search Leads.',
    'Pendiente en tnfg-intake-api — el frontend ya llama GET /case-manager/search-leads.',
    `Query: q? / search?, page?, limit?
${AUTH}`,
    `PAGED_LIST (lead rows) — contrato a definir al implementar`,
  ),
  'case-manager|GET|marketing-reps': d(
    'case-service: g_users Marketing.',
    'intake-api: app_user + ref_department Marketing.',
    `${AUTH}`,
    `[{ userId, name, email, … }]`,
  ),
  'case-manager|GET|transfer-rep-detail/:userId': d(
    'case-service: g_users + hierarchy preview.',
    'intake-api: app_user + hierarchy_membership.',
    `Path: userId (number)
${AUTH}`,
    `{ userId, name, email, region, office, pod, team, … }`,
  ),
  'case-manager|GET|locked-down-today': d(
    'case-service: vista lockdown hoy.',
    'intake-api: lead + lead_timeline.',
    `Query: search?, page?, limit?, order?
${AUTH}`,
    PAGED_LIST.replace('[...]', LEAD_LIST_ITEM),
  ),
  'case-manager|GET|pending-to-sign': d(
    'case-service: pending sign + scope jerarquía.',
    'intake-api: lead Locked Down + timeline.',
    `Query: search?, page?, limit?, order?
${AUTH}`,
    PAGED_LIST.replace('[...]', LEAD_LIST_ITEM),
  ),
  'case-manager|GET|pending-to-sign/count': d(
    'case-service: COUNT pending sign.',
    'intake-api: COUNT TNFG.',
    `${AUTH}`,
    `{ total: number }`,
  ),
  'case-manager|GET|lock-down-drops': d(
    'case-service: drops tras lockdown.',
    'intake-api: lead dropped + timeline.',
    `Query: search?, page?, limit?, order?
${AUTH}`,
    PAGED_LIST.replace('[...]', LEAD_LIST_ITEM),
  ),
  'case-manager|GET|lock-down-drops/count': d(
    'case-service: COUNT drops.',
    'intake-api: COUNT TNFG.',
    `${AUTH}`,
    `{ total: number }`,
  ),
  'case-manager|GET|individual-ld-drops': d(
    'case-service: submitter = email JWT.',
    'intake-api: submitter_user_id del JWT.',
    `Query: search?, page?, limit?, order?
${AUTH}`,
    PAGED_LIST.replace('[...]', LEAD_LIST_ITEM),
  ),
  'case-manager|GET|individual-ld-drops/count': d(
    'case-service: COUNT por submitter email.',
    'intake-api: COUNT por submitter_user_id.',
    `${AUTH}`,
    `{ total: number }`,
  ),
  'case-manager|GET|individual-pending-to-sign': d(
    'case-service: pending + submitter email.',
    'intake-api: pending + submitter_user_id.',
    `Query: search?, page?, limit?, order?
${AUTH}`,
    PAGED_LIST.replace('[...]', LEAD_LIST_ITEM),
  ),
  'case-manager|GET|individual-pending-to-sign/count': d(
    'case-service: COUNT individual pending.',
    'intake-api: COUNT TNFG.',
    `${AUTH}`,
    `{ total: number }`,
  ),
  'case-manager|GET|my-dropped-leads': d(
    'case-service: Dropped + submitter usuario.',
    'intake-api: Dropped + submitter_user_id.',
    `Query: search?, page?, limit?, order?
${AUTH}`,
    PAGED_LIST.replace('[...]', LEAD_LIST_ITEM),
  ),
  'case-manager|GET|hot-leads': d(
    'case-service: isHotLead = 1.',
    'intake-api: is_hot_lead = 1.',
    `Query: search?, page?, limit?, order?
${AUTH}`,
    PAGED_LIST.replace('[...]', LEAD_LIST_ITEM),
  ),
  'case-manager|GET|marketing': d(
    'case-service (Giovanny): tblLeads GROUP BY.',
    'intake-api: lead + org_snapshot + timeline + legal.',
    `Query: period (day|monthly), value (YYYY-MM-DD),
       level (region|office|pod|team),
       group (newlead|lockdown|camein|signed|dropped|lockdowndropped)
${AUTH}`,
    `{
  period, levelType, groupType,
  entities: [{ id, name, value }],
  summary: [{ categoryName, categoryValue }]
}`,
  ),

  'case-catalog|GET|ref-states-legacy': d(
    'case-service → refStates.',
    'intake-api → ref_state is_active=1.',
    `${AUTH}`,
    `{ catalogName: "ref-states-legacy", data: [{ id, name, code }] }`,
  ),
  'case-catalog|GET|insurance?type=': d(
    'case-service → refInsurance.',
    'intake-api → ref_insurance_carrier PIP/AT_FAULT.',
    `Query: type = "Insurance" | "At Fault" | "Location"
${AUTH}`,
    `{ catalogName, data: [{ id, name, … }] }`,
  ),
  'case-catalog|GET|tx-locations?state=&status=': d(
    'case-service → refTXLocations.',
    'intake-api → ref_tx_location + ref_state.',
    `Query: state (nombre), status (ACTIVE|INACTIVE|…)
${AUTH}`,
    `{ catalogName, data: [{ id, name, state, status, … }] }`,
  ),
  'case-catalog|GET|attorneys?state=&status=': d(
    'case-service → refAttorneys.',
    'intake-api → ref_attorney + ref_state.',
    `Query: state, status, activeOnPortal?
${AUTH}`,
    `{ catalogName, data: [{ id, name, state, … }] }`,
  ),
  'case-catalog|GET|severity-levels?type=': d(
    'Portal hardcode PROPERTY_DAMAGE_OPTIONS / PERSONAL_INJURY_OPTIONS.',
    'intake-api → ref_severity_level (labels portal por scope).',
    `Query: type = PropertyDamage | PersonalInjury
${AUTH}`,
    `{ catalogName: "severity-levels", data: [{ id, code, name }] }
code = portal_code_property | portal_code_personal (0, 0b, 1…)
name = display_label_property | display_label_personal`,
  ),
  'case-catalog|GET|injury-sites': d(
    'Portal hardcode INJURY_OPTIONS (23 sitios).',
    'intake-api → ref_injury_site (portal_sort_order).',
    `${AUTH}`,
    `{ catalogName: "injury-sites", data: [{ id, name }] }
name = display_name (valor en PATCH injuries CSV string)`,
  ),
  'case-catalog|GET|at-fault-types': d(
    'case-service → refAtFaultTypes.',
    'intake-api → ref_at_fault_type (+ subtype).',
    `${AUTH}`,
    `{ catalogName: "at-fault-types", data: [{ id, name, subType? }] }`,
  ),
  'case-catalog|GET|accident-or-wc': d(
    'Portal: accidentOrWC texto (Accident / Workers Comp).',
    'intake-api → ref_accident_or_wc (portal seed).',
    `${AUTH}`,
    `{ catalogName: "accident-or-wc", data: [{ id, code, name, txGroup? }] }`,
  ),
  'case-catalog|GET|lead-statuses': d(
    'case-service → refLeadStatus.',
    'intake-api → refLeadStatus + portal_tab_scope / edit_action_label.',
    `Query: tab? (active|dropped|…)
${AUTH}`,
    `{ catalogName: "lead-statuses", data: [{ id, name, tabScope?, editActionLabel? }] }`,
  ),
  'case-catalog|GET|languages': d(
    'Portal: language texto libre en demographics.',
    'intake-api → ref_language (portal seed).',
    `${AUTH}`,
    `{ catalogName: "languages", data: [{ id, code, name }] }`,
  ),
  'case-catalog|GET|comment-sources': d(
    'case-service: — (sin catálogo).',
    'intake-api → ref_comment_source (badges chat).',
    `${AUTH}`,
    `{ catalogName: "comment-sources", data: [{ originCode, displayName, sortOrder }] }`,
  ),

  'case-comments|GET|': d(
    'case-service → case_comment (case_service_dev).',
    'intake-api → lead_note comment.',
    `Path: caseId (= idLead)
Query: limit?, cursor?, status?, origin?
${AUTH}`,
    `{
  items: [{ commentId, body, authorUserId, authorEmail,
           createdAt, documentId, fileUrl?, source,
           sourceOrigin, sourceStatus, sourceLabel,
           mentions?, recipientUserIds? }],
  page: { nextCursor?, hasMore }
}`,
  ),
  'case-comments|POST|': d(
    'case-service: INSERT case_comment.',
    'intake-api: INSERT lead_note comment.',
    `Path: caseId
Body: { body, origin (required), status?, documentId?, mentions?, recipientUserIds? }
${AUTH}`,
    `CommentItem { commentId, body, authorEmail, createdAt, fileUrl?,
  source, sourceOrigin, sourceStatus, sourceLabel, mentions?, recipientUserIds? }`,
  ),
  'case-comments|PATCH|:commentId': d(
    'case-service: UPDATE case_comment (1h, mismo autor).',
    'intake-api: UPDATE lead_note comment.',
    `Path: caseId, commentId
Body: { body?, documentId? }
${AUTH}`,
    `CommentItem actualizado`,
  ),
};

function endpointKey(blockId, method, path) {
  return `${blockId}|${method}|${path}`;
}

function enrichBlocks(blocks) {
  return blocks.map((block) => ({
    ...block,
    endpoints: block.endpoints.map((ep) => {
      const key = endpointKey(block.id, ep.method, ep.path);
      const detail = ENDPOINT_DETAILS[key];
      if (!detail) return ep;
      return { ...ep, ...detail };
    }),
  }));
}

module.exports = { ENDPOINT_DETAILS, enrichBlocks, endpointKey };
