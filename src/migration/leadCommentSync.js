const fs = require('fs');
const path = require('path');
const config = require('../config');

const TABLE = 'lead_note';
const NOTE_TYPE = 'comment';
const READ_PAGE = 8000;
const WRITE_BATCH = 2000;
/** idComment prod ~357k; snapshots tblLeads usan AUTO_INCREMENT desde aquí. */
const SNAPSHOT_NOTE_ID_BASE = 4000000;

/**
 * Cuánto retrocede la ventana respecto del último comentario que ya tenemos.
 * Cubre dos cosas: un comentario escrito sobre un lead que todavía no había
 * llegado al modelo cuando lo leímos (se saltó y hay que volver a verlo), y una
 * edición en Glide de un comentario reciente. Reprocesar de más es barato: el
 * upsert por glide_comment_id es idempotente.
 */
const OVERLAP_MINUTES = 30;

function trimOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

async function columnExists(conn, db, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [db, table, column]
  );
  return rows.length > 0;
}

async function ensureCommentNoteType(targetConn) {
  const db = config.target.database;
  const [rows] = await targetConn.query(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'lead_note' AND COLUMN_NAME = 'note_type'`,
    [db]
  );
  const colType = rows[0]?.COLUMN_TYPE ?? '';
  if (colType.includes("'comment'")) return false;

  const sql = fs.readFileSync(
    path.join(config.sqlDir, 'patches', 'add_lead_note_comment_type.sql'),
    'utf8'
  );
  await targetConn.query(sql);
  return true;
}

/**
 * Agrega glide_comment_id y marca los comentarios que ya estaban copiados de
 * Glide. Esos se reconocen porque el sync viejo escribía id_note = idComment:
 * todo comentario sin source y con id_note dentro del rango de prod vino de
 * Glide (los del portal nacen con AUTO_INCREMENT, por encima de ese rango).
 *
 * Corre una sola vez, en la misma operación que crea la columna: el techo
 * (MAX idComment de prod) sube todos los días y repetir el backfill más
 * adelante etiquetaría comentarios del portal como si fueran de Glide.
 *
 * De paso corrige a qué lead apuntan. El sync viejo guardaba id_lead = IdLead
 * de Glide, que ya no es la PK local: la identidad de Glide es lead.glide_id.
 */
async function ensureGlideCommentId(sourceConn, targetConn) {
  const db = config.target.database;
  const src = config.source.database;
  if (await columnExists(targetConn, db, TABLE, 'glide_comment_id')) {
    return { patched: false, tagged: 0, relinked: 0, unresolved: 0 };
  }

  const [[{ prodMax }]] = await sourceConn.query(
    `SELECT COALESCE(MAX(idComment), 0) AS prodMax FROM \`${src}\`.tblLeadComments`
  );
  const sql = fs.readFileSync(
    path.join(config.sqlDir, 'patches', 'add_lead_note_glide_comment_id.sql'),
    'utf8'
  );
  await targetConn.query(sql);

  const [tag] = await targetConn.query(
    `UPDATE \`${db}\`.\`${TABLE}\`
     SET glide_comment_id = id_note
     WHERE note_type = ? AND source IS NULL AND id_note <= ?`,
    [NOTE_TYPE, Number(prodMax)]
  );

  const [relink] = await targetConn.query(
    `UPDATE \`${db}\`.\`${TABLE}\` n
     INNER JOIN \`${db}\`.\`lead\` l ON l.glide_id = n.id_lead
     SET n.id_lead = l.id_lead
     WHERE n.glide_comment_id IS NOT NULL AND n.id_lead <> l.id_lead`
  );

  const [[{ unresolved }]] = await targetConn.query(
    `SELECT COUNT(*) AS unresolved
     FROM \`${db}\`.\`${TABLE}\` n
     LEFT JOIN \`${db}\`.\`lead\` l ON l.id_lead = n.id_lead
     WHERE n.glide_comment_id IS NOT NULL AND l.id_lead IS NULL`
  );

  return {
    patched: true,
    prodMax: Number(prodMax),
    tagged: Number(tag.affectedRows || 0),
    relinked: Number(relink.affectedRows || 0),
    unresolved: Number(unresolved),
  };
}

async function deleteGlideComments(targetConn) {
  const db = config.target.database;
  const [result] = await targetConn.query(
    `DELETE FROM \`${db}\`.\`${TABLE}\` WHERE glide_comment_id IS NOT NULL`
  );
  return result.affectedRows ?? 0;
}

function resolveUserId(maps, email) {
  const key = trimOrNull(email)?.toLowerCase();
  if (!key) return null;
  return maps.userByEmail.get(key) ?? null;
}

async function loadLeadIdByGlideId(targetConn) {
  const db = config.target.database;
  const [rows] = await targetConn.query(
    `SELECT glide_id, id_lead FROM \`${db}\`.\`lead\` WHERE glide_id IS NOT NULL`
  );
  return new Map(rows.map((r) => [Number(r.glide_id), Number(r.id_lead)]));
}

/**
 * Desde qué idComment leer. Dos cotas, se usa la menor:
 *   · el último glide_comment_id copiado (lo que falta por ids), y
 *   · el primer idComment publicado dentro del solape (lo que pudo haberse
 *     saltado o editado). Las fechas se comparan en el reloj de prod: posted
 *     se copia tal cual a posted_at.
 */
async function resolveStartAfterId(sourceConn, targetConn) {
  const db = config.target.database;
  const src = config.source.database;
  const [[last]] = await targetConn.query(
    `SELECT COALESCE(MAX(glide_comment_id), 0) AS maxId, MAX(posted_at) AS lastPosted
     FROM \`${db}\`.\`${TABLE}\` WHERE glide_comment_id IS NOT NULL`
  );
  let afterId = Number(last.maxId);
  if (!afterId || !last.lastPosted) return { afterId: 0, since: null };

  const since = new Date(last.lastPosted);
  since.setMinutes(since.getMinutes() - OVERLAP_MINUTES);
  const [[win]] = await sourceConn.query(
    `SELECT MIN(idComment) AS firstId FROM \`${src}\`.tblLeadComments WHERE posted >= ?`,
    [since]
  );
  if (win.firstId != null && Number(win.firstId) - 1 < afterId) {
    afterId = Number(win.firstId) - 1;
  }
  return { afterId, since };
}

async function* readSourcePages(sourceConn, afterId) {
  const src = config.source.database;
  let cursor = afterId;
  for (;;) {
    const [rows] = await sourceConn.query(
      `SELECT idComment, IdLead, comment, posted, postedBy
       FROM \`${src}\`.tblLeadComments
       WHERE idComment > ?
         AND comment IS NOT NULL AND TRIM(comment) <> ''
       ORDER BY idComment
       LIMIT ?`,
      [cursor, READ_PAGE]
    );
    if (!rows.length) return;
    yield rows;
    cursor = Number(rows[rows.length - 1].idComment);
  }
}

/** Fila de prod → valores de lead_note. null si el lead no está en el modelo. */
function mapCommentRow(r, leadIdByGlideId, maps) {
  const idLead = leadIdByGlideId.get(Number(r.IdLead));
  if (!idLead) return null;
  return [
    Number(r.idComment),
    idLead,
    NOTE_TYPE,
    String(r.comment).trim(),
    r.posted,
    trimOrNull(r.postedBy),
    resolveUserId(maps, r.postedBy),
  ];
}

/**
 * Upsert por glide_comment_id. id_note lo asigna la base: la PK local nunca
 * se toma de Glide, así no choca con snapshots ni con comentarios del portal.
 */
async function upsertCommentBatch(targetConn, rows) {
  if (!rows.length) return { written: 0, changed: 0 };
  const db = config.target.database;
  let affected = 0;
  for (let i = 0; i < rows.length; i += WRITE_BATCH) {
    const slice = rows.slice(i, i + WRITE_BATCH);
    const ph = slice.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
    const [result] = await targetConn.query(
      `INSERT INTO \`${db}\`.\`${TABLE}\`
         (glide_comment_id, id_lead, note_type, body, posted_at, posted_by, posted_by_user_id)
       VALUES ${ph}
       ON DUPLICATE KEY UPDATE
         id_lead = VALUES(id_lead),
         body = VALUES(body),
         posted_at = VALUES(posted_at),
         posted_by = VALUES(posted_by),
         posted_by_user_id = VALUES(posted_by_user_id)`,
      slice.flat()
    );
    // affectedRows: 1 por insert, 2 por update con cambios, 0 sin cambios.
    // No distingue un insert de un update, así que se reporta cuántas filas
    // se enviaron y cuántas cambiaron algo en la base.
    affected += Number(result.affectedRows || 0);
  }
  return { written: rows.length, changed: affected };
}

async function syncLeadComments(sourceConn, targetConn, maps, { truncate = true, resume = false, onProgress } = {}) {
  const db = config.target.database;
  const src = config.source.database;
  const schemaPatched = await ensureCommentNoteType(targetConn);
  if (schemaPatched) {
    console.log('  ✓ lead_note.note_type + comment');
  }
  const glideId = await ensureGlideCommentId(sourceConn, targetConn);
  if (glideId.patched) {
    console.log(
      `  ✓ lead_note.glide_comment_id: ${glideId.tagged} comentarios Glide marcados` +
        ` (idComment ≤ ${glideId.prodMax}), ${glideId.relinked} reapuntados al lead correcto` +
        (glideId.unresolved ? `, ${glideId.unresolved} sin lead en el modelo` : '')
    );
  }

  if (truncate && !resume) {
    const deleted = await deleteGlideComments(targetConn);
    if (deleted) console.log(`  ✓ comentarios Glide previos eliminados: ${deleted}`);
  }

  const [[{ total }]] = await sourceConn.query(
    `SELECT COUNT(*) AS total FROM \`${src}\`.tblLeadComments
     WHERE comment IS NOT NULL AND TRIM(comment) <> ''`
  );
  const { afterId, since } = resume
    ? await resolveStartAfterId(sourceConn, targetConn)
    : { afterId: 0, since: null };
  if (resume && afterId > 0) {
    console.log(
      `  · resume desde idComment > ${afterId}` +
        (since ? ` (solape ${OVERLAP_MINUTES} min desde ${since.toISOString()})` : '')
    );
  }
  console.log(`  · tblLeadComments en prod: ~${total}`);

  const leadIdByGlideId = await loadLeadIdByGlideId(targetConn);
  let scanned = 0;
  let written = 0;
  let changed = 0;
  let sinLead = 0;
  let lastId = afterId;

  for await (const page of readSourcePages(sourceConn, afterId)) {
    scanned += page.length;
    lastId = Number(page[page.length - 1].idComment);
    const rows = [];
    for (const r of page) {
      const row = mapCommentRow(r, leadIdByGlideId, maps);
      if (!row) {
        sinLead += 1;
        continue;
      }
      rows.push(row);
    }
    const res = await upsertCommentBatch(targetConn, rows);
    written += res.written;
    changed += res.changed;

    if (onProgress) onProgress({ scanned, written, changed, sinLead, total, afterId: lastId });
    else if (scanned % 40000 < READ_PAGE) {
      console.log(`  · ${scanned} leídos (${written} escritos), idComment ≤ ${lastId}…`);
    }
  }

  const [[{ n }]] = await targetConn.query(
    `SELECT COUNT(*) AS n FROM \`${db}\`.\`${TABLE}\` WHERE glide_comment_id IS NOT NULL`
  );
  console.log(
    `  ✓ lead_note (Glide): ${n} filas (${written} escritos, ${changed} con cambios` +
      (sinLead ? `, ${sinLead} sin lead en el modelo` : '') +
      ` en esta corrida)`
  );
  return { written, changed, sinLead, scanned, total: Number(n), glideId };
}

module.exports = {
  TABLE,
  NOTE_TYPE,
  OVERLAP_MINUTES,
  SNAPSHOT_NOTE_ID_BASE,
  ensureGlideCommentId,
  resolveStartAfterId,
  mapCommentRow,
  upsertCommentBatch,
  syncLeadComments,
};
