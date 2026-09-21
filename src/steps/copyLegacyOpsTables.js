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
  // Origin Old del LogReport. En INTAKE van como tablas: las vistas de
  // Glide no se recrean (apuntarían a dbProduction). El ETL lee estos nombres.
  'tblLeadsArchive',
  'vtblLeadsArchive',
  'vLogReportLeadsArchive',
  // Usuarios Glide 1:1 (el ETL lee g_users; no es la vista desde app_user)
  'g_users',
  // Cadena email (FK) + ops que el ETL lee desde TNFG_INTAKE
  'tblEmail',
  'tblEmailConfig',
  'tblEmailLog',
  'tbl_cases_by_attorney_data',
  'tblLeadsAuditBuffer',
];

const DEFAULT_BATCH = Number(process.env.MIG_LEGACY_OPS_BATCH_SIZE || 5000);

async function getSourceTableType(sourceConn, tableName) {
  const src = config.source.database;
  const [[row]] = await sourceConn.query(
    `SELECT TABLE_TYPE AS t FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
    [src, tableName],
  );
  if (!row) throw new Error(`${src}.${tableName} no existe`);
  return String(row.t).toUpperCase();
}

function quoteIdent(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

/** Vista de Glide → BASE TABLE en INTAKE (mismo nombre, sin depender de prod). */
async function materializeViewAsTable(sourceConn, targetConn, tableName) {
  const src = config.source.database;
  const tgt = config.target.database;

  const [cols] = await sourceConn.query(
    `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [src, tableName],
  );
  if (!cols.length) {
    throw new Error(`${tableName}: information_schema.COLUMNS vacío`);
  }

  const defs = cols.map((c) => {
    const nullSql = c.IS_NULLABLE === 'NO' ? ' NOT NULL' : '';
    return `${quoteIdent(c.COLUMN_NAME)} ${c.COLUMN_TYPE}${nullSql}`;
  });

  await targetConn.query('SET FOREIGN_KEY_CHECKS = 0');
  await targetConn.query(`DROP VIEW IF EXISTS ${quoteIdent(tgt)}.${quoteIdent(tableName)}`);
  await targetConn.query(`DROP TABLE IF EXISTS ${quoteIdent(tgt)}.${quoteIdent(tableName)}`);
  await targetConn.query(
    `CREATE TABLE ${quoteIdent(tgt)}.${quoteIdent(tableName)} (${defs.join(', ')})`,
  );
}

async function recreateTableFromSource(sourceConn, targetConn, tableName) {
  const src = config.source.database;
  const tgt = config.target.database;
  const tableType = await getSourceTableType(sourceConn, tableName);

  if (tableType === 'VIEW') {
    console.log(`  · origen es VIEW → se materializa como tabla`);
    await materializeViewAsTable(sourceConn, targetConn, tableName);
    return;
  }

  const [createRows] = await sourceConn.query(
    `SHOW CREATE TABLE \`${src}\`.\`${tableName}\``,
  );
  const createSql = createRows[0]['Create Table'];
  if (!createSql) {
    throw new Error(`SHOW CREATE TABLE vacío para ${tableName}`);
  }

  await targetConn.query('SET FOREIGN_KEY_CHECKS = 0');
  await targetConn.query(`DROP VIEW IF EXISTS \`${tgt}\`.\`${tableName}\``);
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
  { pkMin = null, pkMax = null, onDuplicateKeyNoop = false } = {},
) {
  const src = config.source.database;
  const tgt = config.target.database;

  // Glide permite división por 0 en columnas generadas (DealGoal, etc.).
  try {
    await targetConn.query("SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION'");
  } catch (_) {
    /* ignore */
  }
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

  const onDupSql = onDuplicateKeyNoop
    ? ` ON DUPLICATE KEY UPDATE \`${pkCol}\`=\`${pkCol}\``
    : '';

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
    `SELECT COLUMN_NAME, DATA_TYPE, EXTRA FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [src, tableName],
  );
  const generated = colRows.filter((r) =>
    String(r.EXTRA || '').toUpperCase().includes('GENERATED'),
  );
  const cols = colRows
    .filter((r) => !String(r.EXTRA || '').toUpperCase().includes('GENERATED'))
    .map((r) => r.COLUMN_NAME);
  if (generated.length) {
    console.log(
      `  · omitidas generadas: ${generated.map((r) => r.COLUMN_NAME).join(', ')}`,
    );
  }
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
        `INSERT INTO \`${tgt}\`.\`${tableName}\` (${colList}) VALUES ${valuesClause}${onDupSql}`,
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
  onDuplicateKeyNoop = false,
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
          onDuplicateKeyNoop,
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
