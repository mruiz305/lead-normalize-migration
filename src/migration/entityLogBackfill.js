const config = require('../config');

const BATCH_SIZE = 500;
const MODULE_NAME = 'migration';
const TRANSACTION_NAME = 'backfill-entity-log';

const LOGGED_TABLES = [
  { table: 'user_access_grant', pk: ['grant_id'] },
  { table: 'user_channel', pk: ['id_channel'] },
  { table: 'client', pk: ['id_client'] },
  { table: 'client_address', pk: ['id_address'] },
  { table: 'client_channel', pk: ['id_channel'] },
  { table: 'lead', pk: ['id_lead'] },
  { table: 'lead_accident', pk: ['id_lead'] },
  { table: 'lead_legal', pk: ['id_lead'] },
  { table: 'lead_clinical', pk: ['id_lead'] },
  { table: 'lead_injury', pk: ['id_lead'] },
  { table: 'lead_injury_site', pk: ['id_lead', 'id_injury_site'] },
  { table: 'lead_org_snapshot', pk: ['id_lead'] },
  { table: 'lead_party', pk: ['id_lead_party'] },
  { table: 'lead_party_injury_site', pk: ['id_lead_party', 'id_injury_site'] },
  { table: 'lead_insurance', pk: ['id_lead_insurance'] },
  { table: 'lead_staff', pk: ['id_lead_staff'] },
  { table: 'lead_sync_flag', pk: ['id_sync_flag'] },
];

function quoteTable(table) {
  return table === 'lead' ? '`lead`' : `\`${table}\``;
}

function entityPkFromRow(row, pkCols) {
  return pkCols.map((c) => String(row[c])).join(':');
}

function pkConcatExpr(pkCols) {
  return `CONCAT_WS(':', ${pkCols.map((c) => `\`${c}\``).join(', ')})`;
}

function serializeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'id_log') continue;
    if (v instanceof Date) {
      out[k] = v.toISOString().slice(0, 23).replace('T', ' ');
    } else if (Buffer.isBuffer(v)) {
      out[k] = v.toString('utf8');
    } else if (typeof v === 'bigint') {
      out[k] = Number(v);
    } else {
      out[k] = v;
    }
  }
  return JSON.stringify(out);
}

async function columnExists(conn, db, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [db, table, column]
  );
  return rows.length > 0;
}

async function countPending(conn, db, table) {
  const quoted = quoteTable(table);
  const [[{ cnt }]] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM \`${db}\`.${quoted} WHERE id_log IS NULL`
  );
  return Number(cnt);
}

async function backfillTable(conn, db, spec, { batchSize = BATCH_SIZE, limit = null, onBatch } = {}) {
  const { table, pk: pkCols } = spec;
  const quoted = quoteTable(table);

  if (!(await columnExists(conn, db, table, 'id_log'))) {
    throw new Error(`${table} no tiene columna id_log — ejecutá npm run patch:id-log-columns`);
  }

  const orderBy = pkCols.map((c) => `\`${c}\``).join(', ');
  let total = 0;

  while (true) {
    if (limit != null && total >= limit) break;
    const fetchSize = limit != null ? Math.min(batchSize, limit - total) : batchSize;

    const [rows] = await conn.query(
      `SELECT * FROM \`${db}\`.${quoted} WHERE id_log IS NULL ORDER BY ${orderBy} LIMIT ?`,
      [fetchSize]
    );
    if (!rows.length) break;

    await conn.beginTransaction();
    try {
      const entityRows = rows.map((r) => [
        table,
        entityPkFromRow(r, pkCols),
        1,
        r.created_at ?? new Date(),
      ]);
      const [elResult] = await conn.query(
        `INSERT INTO \`${db}\`.entity_log (entity_table, entity_pk, line_count, created_at)
         VALUES ${entityRows.map(() => '(?, ?, ?, ?)').join(', ')}`,
        entityRows.flat()
      );
      const firstId = elResult.insertId;

      const detailRows = rows.map((r, i) => [
        firstId + i,
        r.created_at ?? new Date(),
        'I',
        MODULE_NAME,
        TRANSACTION_NAME,
        r.created_by_user_id ?? null,
        serializeRow(r),
      ]);
      await conn.query(
        `INSERT INTO \`${db}\`.log_detail
           (id_log, occurred_at, operation, module_name, transaction_name, id_actor_user, after_json)
         VALUES ${detailRows.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
        detailRows.flat()
      );

      if (pkCols.length === 1) {
        const pk = pkCols[0];
        const caseParams = [];
        for (let i = 0; i < rows.length; i++) {
          caseParams.push(rows[i][pk], firstId + i);
        }
        const ids = rows.map((r) => r[pk]);
        await conn.query(
          `UPDATE \`${db}\`.${quoted}
           SET id_log = CASE \`${pk}\` ${rows.map(() => 'WHEN ? THEN ?').join(' ')} END
           WHERE \`${pk}\` IN (${ids.map(() => '?').join(', ')})`,
          [...caseParams, ...ids]
        );
      } else {
        const concat = pkConcatExpr(pkCols);
        const caseParams = [];
        for (let i = 0; i < rows.length; i++) {
          caseParams.push(entityPkFromRow(rows[i], pkCols), firstId + i);
        }
        const keys = rows.map((r) => entityPkFromRow(r, pkCols));
        await conn.query(
          `UPDATE \`${db}\`.${quoted}
           SET id_log = CASE ${concat} ${rows.map(() => 'WHEN ? THEN ?').join(' ')} END
           WHERE ${concat} IN (${keys.map(() => '?').join(', ')})`,
          [...caseParams, ...keys]
        );
      }

      await conn.commit();
      total += rows.length;
      if (onBatch) onBatch({ table, batchRows: rows.length, total });
    } catch (err) {
      await conn.rollback();
      throw err;
    }
  }

  return total;
}

async function backfillEntityLog(conn, options = {}) {
  const db = config.target.database;
  const onlyTable = options.table;
  const specs = onlyTable
    ? LOGGED_TABLES.filter((s) => s.table === onlyTable)
    : LOGGED_TABLES;

  if (onlyTable && !specs.length) {
    throw new Error(`Tabla desconocida: ${onlyTable}`);
  }

  const summary = {};
  for (const spec of specs) {
    const pending = await countPending(conn, db, spec.table);
    if (pending === 0) {
      console.log(`  · ${spec.table} — ya completo`);
      summary[spec.table] = 0;
      continue;
    }

    console.log(`  → ${spec.table} (${pending.toLocaleString()} pendientes)…`);
    const started = Date.now();
    const processed = await backfillTable(conn, db, spec, {
      batchSize: options.batchSize ?? BATCH_SIZE,
      limit: options.limit,
      onBatch: options.verbose
        ? ({ total }) => process.stdout.write(`\r    ${spec.table}: ${total.toLocaleString()}`)
        : null,
    });
    if (options.verbose) process.stdout.write('\n');
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`  ✓ ${spec.table}: ${processed.toLocaleString()} filas (${secs}s)`);
    summary[spec.table] = processed;
  }

  const [[totals]] = await conn.query(`
    SELECT
      (SELECT COUNT(*) FROM \`${db}\`.entity_log) AS entity_log,
      (SELECT COUNT(*) FROM \`${db}\`.log_detail) AS log_detail
  `);

  return { summary, totals };
}

module.exports = {
  LOGGED_TABLES,
  backfillEntityLog,
  backfillTable,
  countPending,
};
