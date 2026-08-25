const config = require('../config');
const { withTarget, withSource } = require('../db');
const { populateHierarchyMembership } = require('../migration/hierarchyMembership');
const { loadCompanyOfficeMap } = require('../migration/officeCatalog');
const {
  pickCanonicalRow,
  normEmail,
  isActiveHr,
  syncUserHrPeriod,
} = require('../migration/userHrPeriod');
const { syncUserChannelsFromGUsers } = require('../migration/userChannelSync');
const {
  resolveHrDealGoal,
  resolveHrDealGoalCustom,
  resolvePaylocityId,
} = require('../migration/gUserCompFields');
const {
  loadDepartmentMapByName,
  resolveDepartmentId,
  loadRankMapByName,
  resolveRankId,
  loadJobTitleMapByName,
  resolveJobTitleId,
} = require('../migration/userHrCatalog');

const BATCH_SIZE = 200;

async function tableExists(conn, db, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
    [db, table]
  );
  return rows.length > 0;
}

async function runCopyUsers({ dryRun = false } = {}) {
  console.log(`Copiando g_users → app_user (${config.source.database} → ${config.target.database})`);

  if (dryRun) {
    console.log('  (dry-run) Se copiarían ~2530 usuarios');
    return;
  }

  await withTarget(async (targetConn) => {
    await withSource(async (sourceConn) => {
      const src = config.source.database;
      const tgt = config.target.database;

      await targetConn.query('SET FOREIGN_KEY_CHECKS = 0');
      await targetConn.query(`TRUNCATE TABLE \`${tgt}\`.hierarchy_membership`);
      if (await tableExists(targetConn, tgt, 'user_channel')) {
        await targetConn.query(`TRUNCATE TABLE \`${tgt}\`.user_channel`);
      }
      await targetConn.query(`TRUNCATE TABLE \`${tgt}\`.app_user`);

      const [rows] = await sourceConn.query(`
        SELECT
          id, rowId, name, email, phone, title, systemAccessLevel, office,
          systemDepartment, \`rank\`, picture, hrEeType, dob,
          hrDealAmount, hrBudget, boostBudget, managementPay,
          DealGoal, DealGoalCustom, hrDealGoal, paylocityId,
          hrStatus, hrHired, hrTermed,
          logsIndividualFile, rosterIndividualFile, machineIndividual,
          leadSheetURL, individualLeadSheetURL
        FROM \`${src}\`.g_users
        WHERE email IS NOT NULL AND TRIM(email) <> ''
        ORDER BY id
      `);

      const byEmail = new Map();
      for (const r of rows) {
        const email = normEmail(r.email);
        if (!email) continue;
        if (!byEmail.has(email)) byEmail.set(email, []);
        byEmail.get(email).push(r);
      }
      const uniqueRows = [...byEmail.values()].map(pickCanonicalRow).filter(Boolean);
      if (uniqueRows.length < rows.length) {
        console.log(
          `  ⚠ ${rows.length - uniqueRows.length} filas duplicadas por email → histórico en user_hr_period`
        );
      }

      const { resolveCompanyOfficeId } = await loadCompanyOfficeMap(targetConn);
      const deptByName = await loadDepartmentMapByName(targetConn);
      const rankByName = await loadRankMapByName(targetConn);
      const titleByName = await loadJobTitleMapByName(targetConn);

      const trimUrl = (v) => {
        if (v == null) return null;
        const s = String(v).trim();
        return s === '' ? null : s;
      };

      const sqlHead = `
        INSERT INTO \`${tgt}\`.app_user (
          id_user, legacy_row_id, display_name, email, phone, id_job_title, access_level,
          id_company_office, id_department, id_rank, picture, hr_ee_type, dob,
          hr_deal_amount, hr_budget, boost_budget, management_pay,
          hr_deal_goal, hr_deal_goal_custom, paylocity_id,
          hr_status, hired_at, termed_at, is_active,
          individual_log_url, roster_file_url, machine_file_url,
          lead_sheet_url, individual_lead_sheet_url
        ) VALUES
      `;
      const rowPlaceholder =
        '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

      let inserted = 0;
      for (let i = 0; i < uniqueRows.length; i += BATCH_SIZE) {
        const batch = uniqueRows.slice(i, i + BATCH_SIZE);
        const placeholders = batch.map(() => rowPlaceholder).join(', ');
        const params = batch.flatMap((r) => {
          const active = isActiveHr(r.hrStatus) ? 1 : 0;
          return [
            r.id,
            r.rowId,
            r.name,
            r.email.trim(),
            r.phone,
            resolveJobTitleId(r.title, titleByName),
            r.systemAccessLevel,
            resolveCompanyOfficeId(r.office),
            resolveDepartmentId(r.systemDepartment, deptByName),
            resolveRankId(r.rank, rankByName),
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
        });
        const [result] = await targetConn.query(`${sqlHead} ${placeholders}`, params);
        inserted += result.affectedRows;
      }

      await targetConn.query('SET FOREIGN_KEY_CHECKS = 1');
      console.log(`  ✓ app_user: ${inserted} filas`);

      console.log('  Histórico HR (user_hr_period)…');
      await syncUserHrPeriod(sourceConn, targetConn, { truncate: true });

      console.log('  Poblando hierarchy_membership…');
      await populateHierarchyMembership(sourceConn, targetConn, { truncate: true });

      console.log('  Contactos staff (user_channel)…');
      if (await tableExists(targetConn, tgt, 'user_channel')) {
        const chStats = await syncUserChannelsFromGUsers(sourceConn, targetConn, { truncate: true });
        console.log(`  ✓ user_channel: ${chStats.total} filas (${chStats.channelRows} desde g_users)`);
      } else {
        console.log('  ⚠ user_channel no existe — ejecutar npm run patch:user-channel');
      }
    });
  });
}

module.exports = { runCopyUsers };
