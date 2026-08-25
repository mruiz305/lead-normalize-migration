const config = require('../config');
const { withTarget, withSource } = require('../db');

/** Copia 1:1 desde dbProduction — misma DDL y datos, sin transformar. */
const LEGACY_OPS_TABLES = [
  'tbl_tmp_all_cases_report',
  'rep_machine_output',
  'tblCron',
  'tblCronConfig',
  'tblLeadConflictCase',
];

const DEFAULT_BATCH = Number(process.env.MIG_LEGACY_OPS_BATCH_SIZE || 5000);

async function recreateTableFromSource(sourceConn, targetConn, tableName) {
  const src = config.source.database;
  const tgt = config.target.database;

  const [createRows] = await sourceConn.query(
    `SHOW CREATE TABLE \`${src}\`.\`${tableName}\``,
  );
  const createSql = createRows[0]['Create Table'];
  if (!createSql) {
    throw new Error(`SHOW CREATE TABLE vacío para ${tableName}`);
  }

  await targetConn.query('SET FOREIGN_KEY_CHECKS = 0');
  await targetConn.query(`DROP TABLE IF EXISTS \`${tgt}\`.\`${tableName}\``);
  await targetConn.query(createSql);
}

async function copyTableData(sourceConn, targetConn, tableName, batchSize) {
  const src = config.source.database;
  const tgt = config.target.database;

  const [[{ c: totalRows }]] = await sourceConn.query(
    `SELECT COUNT(*) AS c FROM \`${src}\`.\`${tableName}\``,
  );

  if (totalRows === 0) {
    console.log(`  ✓ ${tableName}: 0 filas (tabla vacía)`);
    return 0;
  }

  const [colRows] = await sourceConn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [src, tableName],
  );
  const cols = colRows.map((r) => r.COLUMN_NAME);
  const colList = cols.map((c) => `\`${c}\``).join(', ');
  const rowPlaceholder = `(${cols.map(() => '?').join(', ')})`;

  let copied = 0;
  let offset = 0;

  while (offset < totalRows) {
    const [rows] = await sourceConn.query(
      `SELECT * FROM \`${src}\`.\`${tableName}\` LIMIT ? OFFSET ?`,
      [batchSize, offset],
    );
    if (!rows.length) break;

    const valuesClause = rows.map(() => rowPlaceholder).join(', ');
    const params = rows.flatMap((row) => cols.map((c) => row[c]));

    await targetConn.query(
      `INSERT INTO \`${tgt}\`.\`${tableName}\` (${colList}) VALUES ${valuesClause}`,
      params,
    );

    copied += rows.length;
    offset += batchSize;
    process.stdout.write(`\r  … ${tableName}: ${copied}/${totalRows}`);
  }

  console.log(`\r  ✓ ${tableName}: ${copied}/${totalRows} filas`);
  return copied;
}

function resolveTables(only) {
  if (!only?.length) return LEGACY_OPS_TABLES;
  const unknown = only.filter((t) => !LEGACY_OPS_TABLES.includes(t));
  if (unknown.length) {
    throw new Error(`Tabla(s) no permitida(s): ${unknown.join(', ')}`);
  }
  return only;
}

async function runCopyLegacyOpsTables({
  dryRun = false,
  batchSize = DEFAULT_BATCH,
  only = null,
} = {}) {
  if (!config.hasSeparateSource) {
    console.log(
      'copy-legacy-ops: omitido (origen = destino; configura MIG_SOURCE_* distinto de MIG_TARGET_*)',
    );
    return;
  }

  const tables = resolveTables(only);

  console.log(
    `Copiando tablas legacy 1:1 ${config.source.database} → ${config.target.database}`,
  );
  console.log(`  Tablas: ${tables.join(', ')}\n`);

  if (dryRun) {
    await withSource(async (sourceConn) => {
      const src = config.source.database;
      for (const table of tables) {
        const [[{ c }]] = await sourceConn.query(
          `SELECT COUNT(*) AS c FROM \`${src}\`.\`${table}\``,
        );
        console.log(`  (dry-run) ${table}: ${c} filas en origen`);
      }
    });
    return;
  }

  await withTarget(async (targetConn) => {
    await withSource(async (sourceConn) => {
      for (const table of tables) {
        console.log(`→ ${table}`);
        await recreateTableFromSource(sourceConn, targetConn, table);
        await copyTableData(sourceConn, targetConn, table, batchSize);
      }
      await targetConn.query('SET FOREIGN_KEY_CHECKS = 1');
    });
  });
}

module.exports = { runCopyLegacyOpsTables, LEGACY_OPS_TABLES };
