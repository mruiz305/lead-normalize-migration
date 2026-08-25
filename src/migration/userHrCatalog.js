const fs = require('fs');
const path = require('path');
const config = require('../config');

/** Catálogos HR legacy (dbProduction.departments / ranks) → TNFG ref_department / ref_rank */

async function syncDepartmentsCatalog(sourceConn, targetConn) {
  const src = config.source.database;
  const tgt = config.target.database;

  const [rows] = await sourceConn.query(`
    SELECT department_id, department_name, is_active
    FROM \`${src}\`.departments
    ORDER BY department_id
  `);

  await targetConn.query('SET FOREIGN_KEY_CHECKS = 0');
  await targetConn.query(`TRUNCATE TABLE \`${tgt}\`.ref_department`);
  await targetConn.query('SET FOREIGN_KEY_CHECKS = 1');

  if (rows.length) {
    const ph = rows.map(() => '(?, ?, ?)').join(', ');
    await targetConn.query(
      `INSERT INTO \`${tgt}\`.ref_department (department_id, department_name, is_active) VALUES ${ph}`,
      rows.flatMap((r) => [r.department_id, r.department_name, r.is_active ? 1 : 0]),
    );
    return { departments: rows.length };
  }

  const seedPath = path.join(config.sqlDir, 'seeds', 'ref_department_seed.sql');
  if (fs.existsSync(seedPath)) {
    const seed = fs.readFileSync(seedPath, 'utf8');
    await targetConn.query(seed);
    const [[count]] = await targetConn.query(
      `SELECT COUNT(*) AS c FROM \`${tgt}\`.ref_department`,
    );
    return { departments: Number(count.c), seeded: true };
  }

  return { departments: 0 };
}

async function syncRanksCatalog(sourceConn, targetConn) {
  const src = config.source.database;
  const tgt = config.target.database;

  const [rows] = await sourceConn.query(`
    SELECT rank_id, rank_name, is_active
    FROM \`${src}\`.ranks
    ORDER BY rank_id
  `);

  await targetConn.query('SET FOREIGN_KEY_CHECKS = 0');
  await targetConn.query(`TRUNCATE TABLE \`${tgt}\`.ref_rank`);
  await targetConn.query('SET FOREIGN_KEY_CHECKS = 1');

  if (rows.length) {
    const ph = rows.map(() => '(?, ?, ?)').join(', ');
    await targetConn.query(
      `INSERT INTO \`${tgt}\`.ref_rank (rank_id, rank_name, is_active) VALUES ${ph}`,
      rows.flatMap((r) => [r.rank_id, r.rank_name, r.is_active ? 1 : 0]),
    );
  }

  return { ranks: rows.length };
}

async function loadDepartmentMapByName(targetConn) {
  const tgt = config.target.database;
  const [rows] = await targetConn.query(
    `SELECT department_id, department_name FROM \`${tgt}\`.ref_department`,
  );
  const byName = new Map();
  for (const row of rows) {
    const name = String(row.department_name ?? '').trim().toLowerCase();
    if (name) byName.set(name, row.department_id);
  }
  return byName;
}

function resolveDepartmentId(systemDepartment, deptByName) {
  const name = systemDepartment ? String(systemDepartment).trim().toLowerCase() : '';
  if (!name) return null;
  return deptByName.get(name) ?? null;
}

async function loadRankMapByName(targetConn) {
  const tgt = config.target.database;
  const [rows] = await targetConn.query(
    `SELECT rank_id, rank_name FROM \`${tgt}\`.ref_rank`,
  );
  const byName = new Map();
  for (const row of rows) {
    const name = String(row.rank_name ?? '').trim().toLowerCase();
    if (name) byName.set(name, row.rank_id);
  }
  return byName;
}

function resolveRankId(rankName, rankByName) {
  const name = rankName ? String(rankName).trim().toLowerCase() : '';
  if (!name) return null;
  return rankByName.get(name) ?? null;
}

async function syncJobTitlesCatalog(sourceConn, targetConn) {
  const src = config.source.database;
  const tgt = config.target.database;

  const [rows] = await sourceConn.query(`
    SELECT DISTINCT TRIM(title) AS job_title_name
    FROM \`${src}\`.g_users
    WHERE title IS NOT NULL AND TRIM(title) <> ''
    ORDER BY job_title_name
  `);

  let upserted = 0;
  for (const row of rows) {
    await targetConn.query(
      `INSERT INTO \`${tgt}\`.ref_job_title (job_title_name)
       VALUES (?)
       ON DUPLICATE KEY UPDATE job_title_name = VALUES(job_title_name)`,
      [row.job_title_name],
    );
    upserted += 1;
  }

  return { jobTitles: upserted };
}

async function loadJobTitleMapByName(targetConn) {
  const tgt = config.target.database;
  const [rows] = await targetConn.query(
    `SELECT job_title_id, job_title_name FROM \`${tgt}\`.ref_job_title`,
  );
  const byName = new Map();
  for (const row of rows) {
    const name = String(row.job_title_name ?? '').trim().toLowerCase();
    if (name) byName.set(name, row.job_title_id);
  }
  return byName;
}

function resolveJobTitleId(titleName, titleByName) {
  const name = titleName ? String(titleName).trim().toLowerCase() : '';
  if (!name) return null;
  return titleByName.get(name) ?? null;
}

module.exports = {
  syncDepartmentsCatalog,
  syncRanksCatalog,
  syncJobTitlesCatalog,
  loadDepartmentMapByName,
  resolveDepartmentId,
  loadRankMapByName,
  resolveRankId,
  loadJobTitleMapByName,
  resolveJobTitleId,
};
