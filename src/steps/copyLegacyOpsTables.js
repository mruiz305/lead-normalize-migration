const config = require('../config');
const { withTarget, withSource } = require('../db');

/** Copia 1:1 desde dbProduction — misma DDL y datos, sin transformar. */
const LEGACY_OPS_TABLES = [
  'tbl_tmp_all_cases_report',
  'rep_machine_output',
  'tblCron',
  'tblCronConfig',
  'tblLeadConflictCase',
  // Archive histórico (datamart ETL → stg_tblLeadsLogsDuplicateArchiveJun2025)
  'tblLeadsLogsDuplicateArchiveJun2025',
  // Cadena email (FK) + ops que el ETL lee desde TNFG_INTAKE
  'tblEmail',
  'tblEmailConfig',
  'tblEmailLog',
  'tbl_cases_by_attorney_data',
  'tblLeadsAuditBuffer',
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

async function getPrimaryKeyColumn(conn, database, tableName) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = 'PRIMARY'
     ORDER BY ORDINAL_POSITION`,
    [database, tableName],
  );
  if (rows.length !== 1) return null;
  return rows[0].COLUMN_NAME;
}

async function copyTableData(
  sourceConn,
  targetConn,
  tableName,
  batchSize,
  { pkMin = null, pkMax = null } = {},
) {
  const src = config.source.database;
  const tgt = config.target.database;

  // JSON blobs (p.ej. tblLeadsAuditBuffer) estallan max_allowed_packet con batches grandes.
  try {
    await targetConn.query('SET SESSION max_allowed_packet = 67108864');
    await sourceConn.query('SET SESSION max_allowed_packet = 67108864');
  } catch (_) {
    /* sin privilegio: usamos batch chico abajo */
  }

  const pkCol = await getPrimaryKeyColumn(sourceConn, src, tableName);
  if ((pkMin != null || pkMax != null) && !pkCol) {
    throw new Error(`${tableName}: pkMin/pkMax requieren PRIMARY KEY de 1 columna`);
  }

  let whereSql = '1=1';
  const whereParams = [];
  if (pkMin != null) {
    whereSql += ` AND \`${pkCol}\` >= ?`;
    whereParams.push(pkMin);
  }
  if (pkMax != null) {
    whereSql += ` AND \`${pkCol}\` <= ?`;
    whereParams.push(pkMax);
  }

  const [[{ c: totalRows }]] = await sourceConn.query(
    `SELECT COUNT(*) AS c FROM \`${src}\`.\`${tableName}\` WHERE ${whereSql}`,
    whereParams,
  );

  if (totalRows === 0) {
    console.log(`  ✓ ${tableName}: 0 filas (tabla vacía)`);
    return 0;
  }

  const [colRows] = await sourceConn.query(
    `SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [src, tableName],
  );
  const cols = colRows.map((r) => r.COLUMN_NAME);
  const hasJson = colRows.some((r) => String(r.DATA_TYPE).toLowerCase() === 'json');
  let effectiveBatch = hasJson
    ? Math.min(batchSize, Number(process.env.MIG_LEGACY_OPS_JSON_BATCH || 100))
    : batchSize;
  if (hasJson) {
    console.log(`  · ${tableName}: batch inicial ${effectiveBatch} (columnas JSON)`);
  }
  if (pkMin != null || pkMax != null) {
    console.log(`  · rango PK ${pkMin ?? '-∞'}..${pkMax ?? '+∞'} (${totalRows} filas)`);
  }

  const colList = cols.map((c) => `\`${c}\``).join(', ');
  const rowPlaceholder = `(${cols.map(() => '?').join(', ')})`;

  let copied = 0;
  let offset = 0;
  let lastPk = pkMin != null ? pkMin - 1 : null;

  while (copied < totalRows) {
    let rows;
    if (pkCol) {
      const rangeMaxClause = pkMax != null ? ` AND \`${pkCol}\` <= ?` : '';
      const rangeMaxParam = pkMax != null ? [pkMax] : [];
      const [batch] = await sourceConn.query(
        lastPk == null
          ? `SELECT * FROM \`${src}\`.\`${tableName}\`
             WHERE ${whereSql}
             ORDER BY \`${pkCol}\` ASC LIMIT ?`
          : `SELECT * FROM \`${src}\`.\`${tableName}\`
             WHERE \`${pkCol}\` > ?${rangeMaxClause}
             ORDER BY \`${pkCol}\` ASC LIMIT ?`,
        lastPk == null
          ? [...whereParams, effectiveBatch]
          : [lastPk, ...rangeMaxParam, effectiveBatch],
      );
      rows = batch;
    } else {
      const [batch] = await sourceConn.query(
        `SELECT * FROM \`${src}\`.\`${tableName}\` LIMIT ? OFFSET ?`,
        [effectiveBatch, offset],
      );
      rows = batch;
      offset += effectiveBatch;
    }

    if (!rows.length) break;

    const valuesClause = rows.map(() => rowPlaceholder).join(', ');
    // mysql2 parsea columnas JSON → Object; hay que re-serializar al INSERT.
    const params = rows.flatMap((row) =>
      cols.map((c) => {
        const v = row[c];
        if (
          v != null &&
          typeof v === 'object' &&
          !(v instanceof Date) &&
          !Buffer.isBuffer(v)
        ) {
          return JSON.stringify(v);
        }
        return v;
      }),
    );

    try {
      await targetConn.query(
        `INSERT INTO \`${tgt}\`.\`${tableName}\` (${colList}) VALUES ${valuesClause}`,
        params,
      );
    } catch (err) {
      if (
        hasJson &&
        rows.length > 1 &&
        (err.code === 'ER_NET_PACKET_TOO_LARGE' || err.errno === 1153)
      ) {
        effectiveBatch = Math.max(1, Math.floor(rows.length / 2));
        console.log(
          `\n  · ${tableName}: packet too large → retry batch ${effectiveBatch}`,
        );
        continue; // re-fetch same pk window with smaller batch
      }
      throw err;
    }

    copied += rows.length;
    if (pkCol) lastPk = rows[rows.length - 1][pkCol];
    if (copied % 2000 < rows.length || copied === totalRows) {
      process.stdout.write(`\r  … ${tableName}: ${copied}/${totalRows}`);
    }
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
  skipRecreate = false,
  pkMin = null,
  pkMax = null,
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
        if (!skipRecreate) {
          await recreateTableFromSource(sourceConn, targetConn, table);
        } else {
          console.log(`  · skip recreate (append/rango)`);
        }
        await copyTableData(sourceConn, targetConn, table, batchSize, {
          pkMin,
          pkMax,
        });
      }
      await targetConn.query('SET FOREIGN_KEY_CHECKS = 1');
    });
  });
}

module.exports = {
  runCopyLegacyOpsTables,
  LEGACY_OPS_TABLES,
  recreateTableFromSource,
};
