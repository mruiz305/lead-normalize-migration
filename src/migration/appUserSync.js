const config = require('../config');
const { loadCompanyOfficeMap } = require('./officeCatalog');
const { isActiveHr } = require('./userHrPeriod');
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
const { ensureAppUserRowIdKey } = require('./appUserRowIdKey');

const BATCH_SIZE = 200;

const G_USER_SELECT = `
  id, rowId, name, nick, email, phone, title, systemAccessLevel, office, SubOffice,
  systemDepartment, \`rank\`, picture, hrEeType, dob,
  hrDealAmount, hrBudget, boostBudget, managementPay,
  DealGoal, DealGoalCustom, hrDealGoal, paylocityId,
  hrStatus, hrHired, hrTermed,
  logsIndividualFile, rosterIndividualFile, rosterlastmonthFile, machineIndividual,
  leadSheetURL, individualLeadSheetURL, Referred_By
`;

function trimUrl(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function normRowId(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function normText(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function groupByRowId(rows) {
  const byRowId = new Map();
  for (const r of rows) {
    const rowId = normRowId(r.rowId);
    if (!rowId) continue;
    if (!byRowId.has(rowId)) byRowId.set(rowId, []);
    byRowId.get(rowId).push(r);
  }
  return byRowId;
}

/** Una fila por rowId. Si hubiera duplicado (no ocurre en prod), gana el id más alto. */
function uniqueRowsByRowId(rows) {
  const unique = [];
  for (const group of groupByRowId(rows).values()) {
    unique.push(group.sort((a, b) => Number(b.id) - Number(a.id))[0]);
  }
  return unique;
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

function rowToParams(r, maps, idUser) {
  const active = isActiveHr(r.hrStatus) ? 1 : 0;
  const email = normText(r.email);
  return [
    idUser,
    normRowId(r.rowId),
    r.name,
    normText(r.nick),
    email,
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
    trimUrl(r.rosterlastmonthFile),
    trimUrl(r.machineIndividual),
    trimUrl(r.leadSheetURL),
    trimUrl(r.individualLeadSheetURL),
    normText(r.Referred_By),
  ];
}

const INSERT_COLUMNS = `
  id_user, legacy_row_id, display_name, nick, email, phone, id_job_title, access_level,
  id_company_office, id_sub_office, id_department, id_rank, picture, hr_ee_type, dob,
  hr_deal_amount, hr_budget, boost_budget, management_pay,
  hr_deal_goal, hr_deal_goal_custom, paylocity_id,
  hr_status, hired_at, termed_at, is_active,
  individual_log_url, roster_file_url, roster_last_month_file_url, machine_file_url,
  lead_sheet_url, individual_lead_sheet_url, referred_by
`;

const UPDATE_ASSIGNMENTS = `
  display_name = VALUES(display_name),
  nick = VALUES(nick),
  email = VALUES(email),
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
  roster_last_month_file_url = VALUES(roster_last_month_file_url),
  machine_file_url = VALUES(machine_file_url),
  lead_sheet_url = VALUES(lead_sheet_url),
  individual_lead_sheet_url = VALUES(individual_lead_sheet_url),
  referred_by = VALUES(referred_by),
  synced_at = CURRENT_TIMESTAMP
`;

const ROW_PLACEHOLDER =
  '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

async function loadGUsersRows(sourceConn) {
  const src = config.source.database;
  const [rows] = await sourceConn.query(`
    SELECT ${G_USER_SELECT}
    FROM \`${src}\`.g_users
    WHERE rowId IS NOT NULL AND TRIM(rowId) <> ''
    ORDER BY id
  `);
  return rows;
}

function isActiveStatus(hrStatus) {
  return String(hrStatus || '').trim().toLowerCase() === 'active';
}

function hasUsableEmail(r) {
  return Boolean(normText(r.email));
}

/**
 * Upsert g_users → app_user usando rowId (legacy_row_id) como llave.
 * Una fila app_user por Glide rowId. Email se actualiza si cambia; no decide alta/edición.
 */
async function upsertAppUsersFromGUsers(sourceConn, targetConn, {
  dryRun = false,
  activeOnlyInserts = false,
} = {}) {
  const tgt = config.target.database;
  const rows = await loadGUsersRows(sourceConn);
  const uniqueRows = uniqueRowsByRowId(rows);
  const dupes = rows.length - uniqueRows.length;

  let skippedNoEmail = 0;
  const usableRows = [];
  for (const r of uniqueRows) {
    if (!hasUsableEmail(r)) {
      skippedNoEmail += 1;
      continue;
    }
    usableRows.push(r);
  }

  const [[{ beforeCount }]] = await targetConn.query(
    `SELECT COUNT(*) AS beforeCount FROM \`${tgt}\`.app_user`
  );
  const [existing] = await targetConn.query(
    `SELECT id_user, legacy_row_id FROM \`${tgt}\`.app_user
     WHERE legacy_row_id IS NOT NULL AND TRIM(legacy_row_id) <> ''`
  );
  const existingByRowId = new Map(
    existing.map((r) => [normRowId(r.legacy_row_id), Number(r.id_user)])
  );
  const existingIds = new Set(existing.map((r) => Number(r.id_user)));

  const [[{ maxId }]] = await targetConn.query(
    `SELECT COALESCE(MAX(id_user), 0) AS maxId FROM \`${tgt}\`.app_user`
  );
  let nextId = Number(maxId) || 0;

  const toUpdate = [];
  const toInsert = [];
  let skippedTermedNew = 0;
  let remappedIds = 0;

  for (const r of usableRows) {
    const rowId = normRowId(r.rowId);
    const existingId = existingByRowId.get(rowId);
    if (existingId != null) {
      toUpdate.push({ row: r, idUser: existingId });
    } else if (!activeOnlyInserts || isActiveStatus(r.hrStatus)) {
      let idUser = Number(r.id);
      if (!idUser || existingIds.has(idUser)) {
        nextId += 1;
        idUser = nextId;
        remappedIds += 1;
      }
      existingIds.add(idUser);
      toInsert.push({ row: r, idUser });
    } else {
      skippedTermedNew += 1;
    }
  }

  let schema = { changes: [] };
  let subOfficeCatalog = { sourceDistinct: 0, inserted: 0 };
  if (!dryRun) {
    schema = await ensureAppUserRowIdKey(targetConn);
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
      const params = batch.flatMap(({ row, idUser }) => rowToParams(row, maps, idUser));
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

  const activeCanonical = usableRows.filter((r) => isActiveStatus(r.hrStatus)).length;

  return {
    sourceRows: rows.length,
    canonical: usableRows.length,
    activeCanonical,
    duplicateRowIds: dupes,
    skippedNoEmail,
    remappedIds,
    inserted: toInsert.length,
    updated: toUpdate.length,
    skippedTermedNew,
    upserted: dryRun ? 0 : upserted,
    beforeCount: Number(beforeCount),
    afterCount: dryRun ? Number(beforeCount) : Number(afterCount),
    subOfficeCatalog,
    schema,
  };
}

module.exports = {
  G_USER_SELECT,
  uniqueRowsByRowId,
  groupByRowId,
  loadGUsersRows,
  loadCatalogMaps,
  rowToParams,
  upsertAppUsersFromGUsers,
};
