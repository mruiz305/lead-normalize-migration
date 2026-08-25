#!/usr/bin/env node
/** Patch DDL + backfill hr_deal_goal, hr_deal_goal_custom, paylocity_id desde g_users. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, withSource, closeAll } = require('../src/db');
const config = require('../src/config');
const {
  resolveHrDealGoal,
  resolveHrDealGoalCustom,
  resolvePaylocityId,
} = require('../src/migration/gUserCompFields');

async function columnExists(conn, db, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [db, table, column],
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

async function applyPatch(targetConn, db) {
  const patchPath = path.join(config.sqlDir, 'patches', 'add_app_user_deal_goal_paylocity.sql');
  const statements = fs
    .readFileSync(patchPath, 'utf8')
    .split(';')
    .map((s) => s.replace(/--[^\n]*/g, '').trim())
    .filter(Boolean);

  for (const stmt of statements) {
    if (stmt.includes('ADD COLUMN hr_deal_goal_custom')) {
      if (await columnExists(targetConn, db, 'app_user', 'hr_deal_goal_custom')) continue;
    }
    if (stmt.includes('ADD COLUMN paylocity_id')) {
      if (await columnExists(targetConn, db, 'app_user', 'paylocity_id')) continue;
    }
    if (stmt.includes('idx_app_user_paylocity_id')) {
      if (await indexExists(targetConn, db, 'app_user', 'idx_app_user_paylocity_id')) continue;
    }
    await targetConn.query(stmt);
  }
}

async function backfillFromGUsers(sourceConn, targetConn) {
  const src = config.source.database;
  const tgt = config.target.database;

  const [rows] = await sourceConn.query(`
    SELECT id, DealGoal, DealGoalCustom, hrDealGoal, paylocityId
    FROM \`${src}\`.g_users
    WHERE id IS NOT NULL
  `);

  const prepared = rows.map((r) => ({
    id: r.id,
    hr_deal_goal: resolveHrDealGoal(r),
    hr_deal_goal_custom: resolveHrDealGoalCustom(r),
    paylocity_id: resolvePaylocityId(r),
  }));

  const FIELDS = ['hr_deal_goal', 'hr_deal_goal_custom', 'paylocity_id'];
  const BATCH = 200;
  let updated = 0;

  for (let i = 0; i < prepared.length; i += BATCH) {
    const batch = prepared.slice(i, i + BATCH);
    const ids = batch.map((r) => r.id);
    const setClause = FIELDS.map(
      (col) =>
        `${col} = CASE id_user ${batch.map(() => 'WHEN ? THEN ?').join(' ')} ELSE ${col} END`,
    ).join(',\n      ');
    const params = [];
    for (const col of FIELDS) {
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
  console.log(`Backfill deal goal + paylocity → ${db}\n`);

  await withTarget(async (targetConn) => {
    await applyPatch(targetConn, db);
    console.log('  ✓ DDL aplicado (hr_deal_goal_custom, paylocity_id)');

    await withSource(async (sourceConn) => {
      const { gUsers, updated } = await backfillFromGUsers(sourceConn, targetConn);
      console.log(`  ✓ g_users leídos: ${gUsers}, app_user actualizados: ${updated}`);

      const [[stats]] = await targetConn.query(`
        SELECT
          SUM(hr_deal_goal IS NOT NULL AND hr_deal_goal <> 0) AS deal_goal,
          SUM(hr_deal_goal_custom IS NOT NULL AND hr_deal_goal_custom <> 0) AS deal_goal_custom,
          SUM(paylocity_id IS NOT NULL AND TRIM(paylocity_id) <> '') AS paylocity
        FROM \`${db}\`.app_user
      `);
      console.log(
        `  ✓ app_user con deal_goal: ${stats.deal_goal}, custom: ${stats.deal_goal_custom}, paylocity_id: ${stats.paylocity}`,
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
