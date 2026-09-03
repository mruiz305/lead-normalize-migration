const config = require('../config');
const { loadCompanyOfficeMap } = require('./officeCatalog');
const {
  pickCanonicalRow,
  normEmail,
  isActiveHr,
} = require('./userHrPeriod');
const {
  resolveHrDealGoal,
  resolveHrDealGoalCustom,
  resolvePaylocityId,
} = require('./gUserCompFields');
const {
  loadDepartmentMapByName,
  resolveDepartmentId,
  loadRankMapByName,
  resolveRankId,
  loadJobTitleMapByName,
  resolveJobTitleId,
} = require('./userHrCatalog');
const {
  loadSubOfficeMapByCode,
  resolveSubOfficeId,
  ensureSubOfficeCatalogFromGUsers,
} = require('./subOfficeCatalog');

const BATCH_SIZE = 200;

const G_USER_SELECT = `
  id, rowId, name, email, phone, title, systemAccessLevel, office, SubOffice,
  systemDepartment, \`rank\`, picture, hrEeType, dob,
  hrDealAmount, hrBudget, boostBudget, managementPay,
  DealGoal, DealGoalCustom, hrDealGoal, paylocityId,
  hrStatus, hrHired, hrTermed,
  logsIndividualFile, rosterIndividualFile, machineIndividual,
  leadSheetURL, individualLeadSheetURL
`;

function trimUrl(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function groupCanonicalByEmail(rows) {
  const byEmail = new Map();
  for (const r of rows) {
    const email = normEmail(r.email);
    if (!email) continue;
    if (!byEmail.has(email)) byEmail.set(email, []);
    byEmail.get(email).push(r);
  }
  return [...byEmail.values()].map(pickCanonicalRow).filter(Boolean);
}

async function loadCatalogMaps(targetConn) {
  const { resolveCompanyOfficeId } = await loadCompanyOfficeMap(targetConn);
  const deptByName = await loadDepartmentMapByName(targetConn);
  const rankByName = await loadRankMapByName(targetConn);
  const titleByName = await loadJobTitleMapByName(targetConn);
  const subOfficeByCode = await loadSubOfficeMapByCode(targetConn);
  return {
    resolveCompanyOfficeId,
    deptByName,
    rankByName,
    titleByName,
    subOfficeByCode,
  };
}

function rowToParams(r, maps) {
  const active = isActiveHr(r.hrStatus) ? 1 : 0;
  return [
    r.id,
    r.rowId,
    r.name,
    String(r.email).trim(),
    r.phone,
    resolveJobTitleId(r.title, maps.titleByName),
    r.systemAccessLevel,
    maps.resolveCompanyOfficeId(r.office),
    resolveSubOfficeId(r.SubOffice, maps.subOfficeByCode),
    resolveDepartmentId(r.systemDepartment, maps.deptByName),
    resolveRankId(r.rank, maps.rankByName),
    r.picture ?? null,
    r.hrEeType ?? null,
    r.dob ?? null,
    r.hrDealAmount ?? null,
    r.hrBudget ?? null,
    r.boostBudget ?? null,
    r.managementPay ?? null,
    resolveHrDealGoal(r),
    resolveHrDealGoalCustom(r),
    resolvePaylocityId(r),
    r.hrStatus,
    r.hrHired ?? null,
    r.hrTermed ?? null,
    active,
    trimUrl(r.logsIndividualFile),
    trimUrl(r.rosterIndividualFile),
    trimUrl(r.machineIndividual),
    trimUrl(r.leadSheetURL),
    trimUrl(r.individualLeadSheetURL),
  ];
}

const INSERT_COLUMNS = `
  id_user, legacy_row_id, display_name, email, phone, id_job_title, access_level,
  id_company_office, id_sub_office, id_department, id_rank, picture, hr_ee_type, dob,
  hr_deal_amount, hr_budget, boost_budget, management_pay,
  hr_deal_goal, hr_deal_goal_custom, paylocity_id,
  hr_status, hired_at, termed_at, is_active,
  individual_log_url, roster_file_url, machine_file_url,
  lead_sheet_url, individual_lead_sheet_url
`;

const UPDATE_ASSIGNMENTS = `
  legacy_row_id = VALUES(legacy_row_id),
  display_name = VALUES(display_name),
  phone = VALUES(phone),
  id_job_title = VALUES(id_job_title),
  access_level = VALUES(access_level),
  id_company_office = VALUES(id_company_office),
  id_sub_office = VALUES(id_sub_office),
  id_department = VALUES(id_department),
  id_rank = VALUES(id_rank),
  picture = VALUES(picture),
  hr_ee_type = VALUES(hr_ee_type),
  dob = VALUES(dob),
  hr_deal_amount = VALUES(hr_deal_amount),
  hr_budget = VALUES(hr_budget),
  boost_budget = VALUES(boost_budget),
  management_pay = VALUES(management_pay),
  hr_deal_goal = VALUES(hr_deal_goal),
  hr_deal_goal_custom = VALUES(hr_deal_goal_custom),
  paylocity_id = VALUES(paylocity_id),
  hr_status = VALUES(hr_status),
  hired_at = VALUES(hired_at),
  termed_at = VALUES(termed_at),
  is_active = VALUES(is_active),
  individual_log_url = VALUES(individual_log_url),
  roster_file_url = VALUES(roster_file_url),
  machine_file_url = VALUES(machine_file_url),
  lead_sheet_url = VALUES(lead_sheet_url),
  individual_lead_sheet_url = VALUES(individual_lead_sheet_url),
  synced_at = CURRENT_TIMESTAMP
`;

const ROW_PLACEHOLDER =
  '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

async function loadGUsersRows(sourceConn) {
  const src = config.source.database;
  const [rows] = await sourceConn.query(`
    SELECT ${G_USER_SELECT}
    FROM \`${src}\`.g_users
    WHERE email IS NOT NULL AND TRIM(email) <> ''
    ORDER BY id
  `);
  return rows;
}

function isActiveStatus(hrStatus) {
  return String(hrStatus || '').trim().toLowerCase() === 'active';
}

/**
 * Upsert g_users → app_user usando email como llave (uk_app_user_email).
 * Espejo de prod: 4075 filas g_users → ~4051 app_user (1 fila por email canónico).
 * - Existentes: UPDATE por email.
 * - Nuevos: INSERT (Active y Termed), salvo --active-only.
 */
async function upsertAppUsersFromGUsers(sourceConn, targetConn, {
  dryRun = false,
  activeOnlyInserts = false,
} = {}) {
  const tgt = config.target.database;
  const rows = await loadGUsersRows(sourceConn);
  const uniqueRows = groupCanonicalByEmail(rows);
  const dupes = rows.length - uniqueRows.length;

  const [[{ beforeCount }]] = await targetConn.query(
    `SELECT COUNT(*) AS beforeCount FROM \`${tgt}\`.app_user`
  );
  const [existing] = await targetConn.query(
    `SELECT LOWER(TRIM(email)) AS email FROM \`${tgt}\`.app_user`
  );
  const existingEmails = new Set(existing.map((r) => r.email));

  const toUpdate = [];
  const toInsert = [];
  let skippedTermedNew = 0;

  for (const r of uniqueRows) {
    const email = normEmail(r.email);
    if (existingEmails.has(email)) {
      toUpdate.push(r);
    } else if (!activeOnlyInserts || isActiveStatus(r.hrStatus)) {
      toInsert.push(r);
    } else {
      skippedTermedNew += 1;
    }
  }

  let subOfficeCatalog = { sourceDistinct: 0, inserted: 0 };
  if (!dryRun) {
    subOfficeCatalog = await ensureSubOfficeCatalogFromGUsers(sourceConn, targetConn);
  }
  const maps = await loadCatalogMaps(targetConn);
  if (!dryRun) {
    maps.subOfficeByCode = await loadSubOfficeMapByCode(targetConn);
  }

  const sqlHead = `
    INSERT INTO \`${tgt}\`.app_user (${INSERT_COLUMNS})
    VALUES
  `;

  let upserted = 0;
  if (!dryRun) {
    const runBatch = async (batch) => {
      if (!batch.length) return;
      const params = batch.flatMap((r) => rowToParams(r, maps));
      await targetConn.query(
        `${sqlHead} ${batch.map(() => ROW_PLACEHOLDER).join(', ')}
         ON DUPLICATE KEY UPDATE ${UPDATE_ASSIGNMENTS}`,
        params
      );
      upserted += batch.length;
    };

    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      await runBatch(toInsert.slice(i, i + BATCH_SIZE));
    }
    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      await runBatch(toUpdate.slice(i, i + BATCH_SIZE));
    }
  }

  const [[{ afterCount }]] = dryRun
    ? [[{ afterCount: beforeCount }]]
    : await targetConn.query(`SELECT COUNT(*) AS afterCount FROM \`${tgt}\`.app_user`);

  const activeCanonical = uniqueRows.filter((r) => isActiveStatus(r.hrStatus)).length;

  return {
    sourceRows: rows.length,
    canonical: uniqueRows.length,
    activeCanonical,
    duplicateEmails: dupes,
    inserted: toInsert.length,
    updated: toUpdate.length,
    skippedTermedNew,
    upserted: dryRun ? 0 : upserted,
    beforeCount: Number(beforeCount),
    afterCount: dryRun ? Number(beforeCount) : Number(afterCount),
    subOfficeCatalog,
  };
}

module.exports = {
  G_USER_SELECT,
  groupCanonicalByEmail,
  loadGUsersRows,
  loadCatalogMaps,
  rowToParams,
  upsertAppUsersFromGUsers,
};
