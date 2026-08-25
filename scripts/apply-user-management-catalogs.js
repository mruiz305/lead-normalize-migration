#!/usr/bin/env node
/** Patch + copia ref_department/ref_rank + backfill campos UM en app_user desde g_users. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, withSource, closeAll } = require('../src/db');
const config = require('../src/config');
const {
  syncDepartmentsCatalog,
  syncRanksCatalog,
  syncJobTitlesCatalog,
  loadDepartmentMapByName,
  loadRankMapByName,
  loadJobTitleMapByName,
  resolveDepartmentId,
  resolveRankId,
  resolveJobTitleId,
} = require('../src/migration/userHrCatalog');
const {
  resolveHrDealGoal,
  resolveHrDealGoalCustom,
  resolvePaylocityId,
} = require('../src/migration/gUserCompFields');

async function tableExists(conn, db, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
    [db, table],
  );
  return rows.length > 0;
}

async function columnExists(conn, db, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [db, table, column],
  );
  return rows.length > 0;
}

async function constraintExists(conn, db, table, name) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? LIMIT 1`,
    [db, table, name],
  );
  return rows.length > 0;
}

async function indexExists(conn, db, table, name) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [db, table, name],
  );
  return rows.length > 0;
}

async function applySqlPatch(targetConn, db, patchFile, opts = {}) {
  const patchPath = path.join(config.sqlDir, 'patches', patchFile);
  const statements = fs
    .readFileSync(patchPath, 'utf8')
    .split(';')
    .map((s) => s.replace(/--[^\n]*/g, '').trim())
    .filter(Boolean);

  for (const stmt of statements) {
    if (stmt.startsWith('CREATE TABLE')) {
      const table = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/i)?.[1];
      if (table && (await tableExists(targetConn, db, table))) continue;
    }
    if (stmt.startsWith('ALTER TABLE app_user') && stmt.includes('ADD COLUMN')) {
      const col = stmt.match(/ADD COLUMN [`']?(\w+)[`']?/i)?.[1];
      if (col && (await columnExists(targetConn, db, 'app_user', col))) continue;
    }
    if (stmt.includes('DROP COLUMN')) {
      const col = stmt.match(/DROP COLUMN [`']?(\w+)[`']?/i)?.[1];
      if (!col || !(await columnExists(targetConn, db, 'app_user', col))) continue;
    }
    if (stmt.includes('fk_app_user_department')) {
      if (await constraintExists(targetConn, db, 'app_user', 'fk_app_user_department')) continue;
    }
    if (stmt.includes('fk_app_user_rank')) {
      if (await constraintExists(targetConn, db, 'app_user', 'fk_app_user_rank')) continue;
    }
    if (stmt.includes('idx_app_user_department')) {
      if (await indexExists(targetConn, db, 'app_user', 'idx_app_user_department')) continue;
    }
    if (stmt.includes('idx_app_user_rank')) {
      if (await indexExists(targetConn, db, 'app_user', 'idx_app_user_rank')) continue;
    }
    if (stmt.includes('fk_app_user_job_title')) {
      if (await constraintExists(targetConn, db, 'app_user', 'fk_app_user_job_title')) continue;
    }
    if (stmt.includes('idx_app_user_job_title')) {
      if (await indexExists(targetConn, db, 'app_user', 'idx_app_user_job_title')) continue;
    }
    if (stmt.includes('ADD COLUMN hr_deal_goal_custom')) {
      if (await columnExists(targetConn, db, 'app_user', 'hr_deal_goal_custom')) continue;
    }
    if (stmt.includes('ADD COLUMN paylocity_id')) {
      if (await columnExists(targetConn, db, 'app_user', 'paylocity_id')) continue;
    }
    if (stmt.includes('idx_app_user_paylocity_id')) {
      if (await indexExists(targetConn, db, 'app_user', 'idx_app_user_paylocity_id')) continue;
    }
    if (stmt.startsWith('UPDATE app_user') && opts.skipRankTextMigration) continue;
    if (stmt.startsWith('UPDATE app_user') && opts.skipTitleTextMigration) continue;
    await targetConn.query(stmt);
  }
}

async function backfillAppUserHrFields(
  sourceConn,
  targetConn,
  deptByName,
  rankByName,
  titleByName,
) {
  const src = config.source.database;
  const tgt = config.target.database;

  const [rows] = await sourceConn.query(`
    SELECT id, title, systemDepartment, \`rank\`, picture, hrEeType, dob,
           hrDealAmount, hrBudget, boostBudget, managementPay,
           DealGoal, DealGoalCustom, hrDealGoal, paylocityId
    FROM \`${src}\`.g_users
    WHERE id IS NOT NULL
  `);

  const prepared = rows.map((r) => ({
    id: r.id,
    id_job_title: resolveJobTitleId(r.title, titleByName),
    id_department: resolveDepartmentId(r.systemDepartment, deptByName),
    id_rank: resolveRankId(r.rank, rankByName),
    picture: r.picture ?? null,
    hr_ee_type: r.hrEeType ?? null,
    dob: r.dob ?? null,
    hr_deal_amount: r.hrDealAmount ?? null,
    hr_budget: r.hrBudget ?? null,
    boost_budget: r.boostBudget ?? null,
    management_pay: r.managementPay ?? null,
    hr_deal_goal: resolveHrDealGoal(r),
    hr_deal_goal_custom: resolveHrDealGoalCustom(r),
    paylocity_id: resolvePaylocityId(r),
  }));

  const UM_FIELDS = [
    'id_job_title',
    'id_department',
    'id_rank',
    'picture',
    'hr_ee_type',
    'dob',
    'hr_deal_amount',
    'hr_budget',
    'boost_budget',
    'management_pay',
    'hr_deal_goal',
    'hr_deal_goal_custom',
    'paylocity_id',
  ];

  const BATCH = 200;
  let updated = 0;
  for (let i = 0; i < prepared.length; i += BATCH) {
    const batch = prepared.slice(i, i + BATCH);
    const ids = batch.map((r) => r.id);
    const setClause = UM_FIELDS.map(
      (col) =>
        `${col} = CASE id_user ${batch.map(() => 'WHEN ? THEN ?').join(' ')} ELSE ${col} END`,
    ).join(',\n      ');
    const params = [];
    for (const col of UM_FIELDS) {
      for (const row of batch) {
        params.push(row.id, row[col]);
      }
    }
    params.push(...ids);

    const sql = `
      UPDATE \`${tgt}\`.app_user
      SET ${setClause}
      WHERE id_user IN (${ids.map(() => '?').join(', ')})
    `;
    const [result] = await targetConn.query(sql, params);
    updated += result.changedRows ?? result.affectedRows ?? 0;
  }
  return { gUsers: rows.length, updated };
}

async function main() {
  const db = config.target.database;
  console.log(`Patch User Management catalogs → ${db}\n`);

  await withTarget(async (targetConn) => {
    await applySqlPatch(targetConn, db, 'add_user_management_catalogs.sql');
    console.log('  ✓ DDL base aplicado');

    await applySqlPatch(targetConn, db, 'add_app_user_deal_goal_paylocity.sql');
    console.log('  ✓ deal goal + paylocity DDL aplicado');

    const hadRankText = await columnExists(targetConn, db, 'app_user', 'rank');
    await applySqlPatch(targetConn, db, 'normalize_app_user_catalog_fks.sql', {
      skipRankTextMigration: !hadRankText,
    });
    if (hadRankText) console.log('  ✓ rank (texto) → id_rank (FK)');

    await withSource(async (sourceConn) => {
      const deptStats = await syncDepartmentsCatalog(sourceConn, targetConn);
      console.log(
        `  ✓ ref_department: ${deptStats.departments} filas${deptStats.seeded ? ' (seed)' : ''}`,
      );

      const rankStats = await syncRanksCatalog(sourceConn, targetConn);
      console.log(`  ✓ ref_rank: ${rankStats.ranks} filas`);

      const titleStats = await syncJobTitlesCatalog(sourceConn, targetConn);
      console.log(`  ✓ ref_job_title: ${titleStats.jobTitles} filas`);

      const hadTitleText = await columnExists(targetConn, db, 'app_user', 'title');
      await applySqlPatch(targetConn, db, 'normalize_app_user_job_title.sql', {
        skipTitleTextMigration: !hadTitleText,
      });
      if (hadTitleText) console.log('  ✓ title (texto) → id_job_title (FK)');

      const deptByName = await loadDepartmentMapByName(targetConn);
      const rankByName = await loadRankMapByName(targetConn);
      const titleByName = await loadJobTitleMapByName(targetConn);
      const { gUsers, updated } = await backfillAppUserHrFields(
        sourceConn,
        targetConn,
        deptByName,
        rankByName,
        titleByName,
      );
      console.log(`  ✓ g_users leídos: ${gUsers}, app_user actualizados: ${updated}`);

      const [[stats]] = await targetConn.query(`
        SELECT
          SUM(id_job_title IS NOT NULL) AS with_title,
          SUM(id_department IS NOT NULL) AS with_dept,
          SUM(id_rank IS NOT NULL) AS with_rank
        FROM \`${db}\`.app_user
      `);
      console.log(
        `  ✓ app_user con id_job_title: ${stats.with_title}, id_department: ${stats.with_dept}, id_rank: ${stats.with_rank}`,
      );
    });
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
