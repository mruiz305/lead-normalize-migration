const { readSql } = require('../sqlRunner');
const { withTarget } = require('../db');
const config = require('../config');

async function runTruncate({ dryRun = false } = {}) {
  const sql = readSql('00_truncate.sql');
  console.log('Truncate: vacía tablas normalizadas (no toca tblLeads ni catálogos)');

  if (dryRun) {
    console.log('  (dry-run) Se ejecutaría 00_truncate.sql en destino');
    return;
  }

  await withTarget(async (conn) => {
    const db = config.target.database;
    const tables = [...sql.matchAll(/TRUNCATE TABLE\s+(`?\w+`?)/gi)]
      .map((m) => m[1].replace(/`/g, ''));

    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of tables) {
      const [exists] = await conn.query(
        `SELECT 1 FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
        [db, table]
      );
      if (!exists.length) {
        console.log(`  · skip ${table} (no existe aún)`);
        continue;
      }
      await conn.query(`TRUNCATE TABLE \`${db}\`.\`${table}\``);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('  ✓ truncate completado');
  });
}

module.exports = { runTruncate };
