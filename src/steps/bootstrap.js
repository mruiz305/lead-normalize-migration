const { readSql, execSql } = require('../sqlRunner');
const { withTarget } = require('../db');

async function runBootstrap({ dryRun = false } = {}) {
  const sql = readSql('01_bootstrap.sql');
  console.log('Bootstrap: DDL + seeds de catálogos pequeños');

  if (dryRun) {
    console.log('  (dry-run) Se ejecutaría 01_bootstrap.sql en destino');
    return;
  }

  await withTarget(async (conn) => {
    await execSql(conn, sql, '01_bootstrap.sql');
  });
}

module.exports = { runBootstrap };
