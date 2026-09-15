const config = require('../config');

const TABLE = 'lead_status_log';
const SOURCE_TABLE = 'tblLeadsLogsStatus';
const READ_PAGE = 20000;
const WRITE_BATCH = 1000;

/**
 * Cuánto retrocede la ventana incremental respecto del último row_changed_at
 * que ya tenemos. Es margen para filas que Glide tocó mientras corríamos: sin
 * él, una escritura entre el SELECT y el commit se pierde hasta que ese lead
 * vuelva a cambiar, que puede ser nunca.
 */
const OVERLAP_MINUTES = 15;

/**
 * Desde cuándo pedirle cambios a prod.
 *
 * El corte sale del dato, no del reloj: es el mayor row_changed_at que ya
 * copiamos, menos el solape. Comparar valores de prod contra valores de prod
 * evita el problema que nos costó el sync incremental — prod corre en
 * America/New_York y cualquier corte armado con la hora local apunta al futuro
 * de prod y no trae nada.
 */
async function resolveSince(targetConn) {
  const db = config.target.database;
  const [[row]] = await targetConn.query(
    `SELECT MAX(row_changed_at) AS last FROM \`${db}\`.${TABLE}`
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

async function* readSourcePages(sourceConn, since) {
  const src = config.source.database;
  const where = since ? 'row_changed_at >= ?' : '1=1';
  let afterId = 0;
  for (;;) {
    const params = since ? [since, afterId, READ_PAGE] : [afterId, READ_PAGE];
    const [rows] = await sourceConn.query(
      `SELECT Id, IdLead, IdLeadOld, LogStatus, CreatedAt, row_changed_at
       FROM \`${src}\`.${SOURCE_TABLE}
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

async function flush(targetConn, batch) {
  if (!batch.length) return 0;
  const db = config.target.database;
  const ph = '(?, ?, ?, ?, ?, ?, ?)';
  let written = 0;
  for (let i = 0; i < batch.length; i += WRITE_BATCH) {
    const slice = batch.slice(i, i + WRITE_BATCH);
    const [result] = await targetConn.query(
      `INSERT INTO \`${db}\`.${TABLE}
         (glide_log_id, id_lead, glide_lead_id, id_lead_old, log_status, created_at, row_changed_at)
       VALUES ${slice.map(() => ph).join(', ')}
       ON DUPLICATE KEY UPDATE
         id_lead = VALUES(id_lead),
         glide_lead_id = VALUES(glide_lead_id),
         id_lead_old = VALUES(id_lead_old),
         log_status = VALUES(log_status),
         created_at = VALUES(created_at),
         row_changed_at = VALUES(row_changed_at)`,
      slice.flat()
    );
    // affectedRows cuenta 2 por fila actualizada y 1 por insertada; para el
    // reporte solo nos interesa cuántas filas mandamos.
    written += slice.length;
    void result;
  }
  return written;
}

/**
 * Espeja prod.tblLeadsLogsStatus en TNFG_INTAKE.lead_status_log.
 *
 * Las filas cuyo lead todavía no está en el modelo se saltan sin ruido: el
 * lead llega en el sync siguiente y, como Glide no le mueve el row_changed_at
 * por eso, el solape de la ventana la vuelve a traer.
 */
async function syncLeadStatusLog(sourceConn, targetConn, { full = false, onProgress } = {}) {
  const since = full ? null : await resolveSince(targetConn);
  const leadIdByGlideId = await loadLeadIdByGlideId(targetConn);

  let read = 0;
  let written = 0;
  let sinLead = 0;

  for await (const rows of readSourcePages(sourceConn, since)) {
    read += rows.length;
    const batch = [];
    for (const r of rows) {
      const idLead = leadIdByGlideId.get(Number(r.IdLead));
      if (!idLead) {
        sinLead += 1;
        continue;
      }
      batch.push([
        Number(r.Id),
        idLead,
        Number(r.IdLead),
        r.IdLeadOld ?? null,
        String(r.LogStatus ?? '').trim().toUpperCase(),
        r.CreatedAt ?? null,
        r.row_changed_at ?? null,
      ]);
    }
    written += await flush(targetConn, batch);
    if (onProgress) onProgress({ read, written, sinLead });
  }

  return { since, read, written, sinLead };
}

module.exports = {
  TABLE,
  SOURCE_TABLE,
  OVERLAP_MINUTES,
  resolveSince,
  syncLeadStatusLog,
};
