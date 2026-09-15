const config = require('../config');

const READ_PAGE = 20000;
const WRITE_BATCH = 1000;

/**
 * Cuánto retrocede la ventana incremental respecto del último row_changed_at
 * que ya copiamos. Es margen para filas que Glide tocó mientras corríamos: sin
 * él, una escritura entre el SELECT y el commit se pierde hasta que ese lead
 * vuelva a cambiar, que puede ser nunca.
 */
const OVERLAP_MINUTES = 15;

/**
 * Espejo de una tabla de Glide dentro del modelo nuevo.
 *
 * Hay tablas de las que depende el tablero y que no se pueden derivar de lo
 * migrado — el estado operativo del lead, su estado legal/clínico vigente. El
 * modelo las tiene que guardar, no reconstruir, y este helper es la forma de
 * traerlas: identidad del origen, enlace al lead local, ventana incremental
 * por row_changed_at y upsert.
 *
 * El corte de la ventana sale del dato, no del reloj: es el mayor
 * row_changed_at que ya copiamos, menos el solape. Comparar valores de prod
 * contra valores de prod evita el problema que nos costó el sync incremental,
 * donde un corte armado con la hora local apuntaba al futuro de prod — que
 * corre en America/New_York — y no traía nada.
 */
async function resolveSince(targetConn, table) {
  const db = config.target.database;
  const [[row]] = await targetConn.query(
    `SELECT MAX(row_changed_at) AS last FROM \`${db}\`.${table}`
  );
  if (!row.last) return null;
  const since = new Date(row.last);
  since.setMinutes(since.getMinutes() - OVERLAP_MINUTES);
  return since;
}

async function loadLeadIdByGlideId(targetConn) {
  const db = config.target.database;
  const [rows] = await targetConn.query(
    `SELECT glide_id, id_lead FROM \`${db}\`.\`lead\` WHERE glide_id IS NOT NULL`
  );
  return new Map(rows.map((r) => [Number(r.glide_id), Number(r.id_lead)]));
}

async function* readSourcePages(sourceConn, sourceTable, select, since) {
  const src = config.source.database;
  const where = since ? 'row_changed_at >= ?' : '1=1';
  let afterId = 0;
  for (;;) {
    const params = since ? [since, afterId, READ_PAGE] : [afterId, READ_PAGE];
    const [rows] = await sourceConn.query(
      `SELECT ${select}
       FROM \`${src}\`.${sourceTable}
       WHERE ${where} AND Id > ?
       ORDER BY Id
       LIMIT ?`,
      params
    );
    if (!rows.length) return;
    yield rows;
    afterId = Number(rows[rows.length - 1].Id);
  }
}

async function flush(targetConn, table, columns, batch) {
  if (!batch.length) return 0;
  const db = config.target.database;
  const ph = `(${columns.map(() => '?').join(', ')})`;
  // La PK es la identidad de origen, así que un choque es una fila que Glide
  // ya nos había dado y volvió a cambiar.
  const update = columns
    .slice(1)
    .map((c) => `${c} = VALUES(${c})`)
    .join(', ');

  let written = 0;
  for (let i = 0; i < batch.length; i += WRITE_BATCH) {
    const slice = batch.slice(i, i + WRITE_BATCH);
    await targetConn.query(
      `INSERT INTO \`${db}\`.${table} (${columns.join(', ')})
       VALUES ${slice.map(() => ph).join(', ')}
       ON DUPLICATE KEY UPDATE ${update}`,
      slice.flat()
    );
    written += slice.length;
  }
  return written;
}

/**
 * @param {object} spec
 * @param {string} spec.table        tabla destino en el modelo
 * @param {string} spec.sourceTable  tabla en Glide
 * @param {string} spec.select       columnas a leer del origen (incluye Id e IdLead)
 * @param {string[]} spec.columns    columnas a escribir; la primera es la PK
 * @param {(row, idLead) => any[]} spec.mapRow
 */
async function mirrorGlideTable(sourceConn, targetConn, spec, { full = false, onProgress } = {}) {
  const since = full ? null : await resolveSince(targetConn, spec.table);
  const leadIdByGlideId = await loadLeadIdByGlideId(targetConn);

  let read = 0;
  let written = 0;
  let sinLead = 0;

  for await (const rows of readSourcePages(sourceConn, spec.sourceTable, spec.select, since)) {
    read += rows.length;
    const batch = [];
    for (const r of rows) {
      const idLead = leadIdByGlideId.get(Number(r.IdLead));
      if (!idLead) {
        sinLead += 1;
        continue;
      }
      batch.push(spec.mapRow(r, idLead));
    }
    written += await flush(targetConn, spec.table, spec.columns, batch);
    if (onProgress) onProgress({ read, written, sinLead });
  }

  return { since, read, written, sinLead };
}

module.exports = {
  OVERLAP_MINUTES,
  resolveSince,
  mirrorGlideTable,
};
