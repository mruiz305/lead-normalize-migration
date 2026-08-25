const config = require('../config');

const TABLE = 'lead_note';
const NOTE_TYPE = 'comment';
const FLUSH_BATCH = 8000;
/** idComment prod ~357k; snapshots tblLeads usan AUTO_INCREMENT desde aquí. */
const SNAPSHOT_NOTE_ID_BASE = 4000000;

function trimOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
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

  const fs = require('fs');
  const path = require('path');
  const sql = fs.readFileSync(
    path.join(config.sqlDir, 'patches', 'add_lead_note_comment_type.sql'),
    'utf8'
  );
  await targetConn.query(sql);
  return true;
}

async function deleteCommentNotes(targetConn) {
  const db = config.target.database;
  const [result] = await targetConn.query(
    `DELETE FROM \`${db}\`.\`${TABLE}\` WHERE note_type = ?`,
    [NOTE_TYPE]
  );
  return result.affectedRows ?? 0;
}

function resolveUserId(maps, email) {
  const key = trimOrNull(email)?.toLowerCase();
  if (!key) return null;
  return maps.userByEmail.get(key) ?? null;
}

async function countSourceComments(sourceConn) {
  const src = config.source.database;
  const tgt = config.target.database;

  if (config.sameServerAsTarget) {
    const [[{ n }]] = await sourceConn.query(`
      SELECT COUNT(*) AS n
      FROM \`${src}\`.tblLeadComments c
      INNER JOIN \`${tgt}\`.lead l ON l.id_lead = c.IdLead
      WHERE c.comment IS NOT NULL AND TRIM(c.comment) <> ''
    `);
    return Number(n);
  }

  const [[{ n }]] = await sourceConn.query(`
    SELECT COUNT(*) AS n FROM \`${src}\`.tblLeadComments
    WHERE comment IS NOT NULL AND TRIM(comment) <> ''
  `);
  return Number(n);
}

async function fetchCommentBatch(sourceConn, targetConn, { afterId = 0, limit = FLUSH_BATCH } = {}) {
  const src = config.source.database;
  const tgt = config.target.database;

  if (config.sameServerAsTarget) {
    const [rows] = await targetConn.query(
      `
      SELECT c.idComment, c.IdLead, c.comment, c.posted, c.postedBy
      FROM \`${src}\`.tblLeadComments c
      INNER JOIN \`${tgt}\`.lead l ON l.id_lead = c.IdLead
      WHERE c.idComment > ?
        AND c.comment IS NOT NULL AND TRIM(c.comment) <> ''
      ORDER BY c.idComment
      LIMIT ?`,
      [afterId, limit]
    );
    const nextAfterId = rows.length ? Number(rows[rows.length - 1].idComment) : afterId;
    return { rows, nextAfterId, done: !rows.length };
  }

  // Servidores distintos: no JOIN cross-host. Avanzar cursor aunque el batch
  // quede vacío tras filtrar leads que aún no están en el modelo.
  let cursor = afterId;
  for (let attempt = 0; attempt < 50; attempt++) {
    const [raw] = await sourceConn.query(
      `
      SELECT idComment, IdLead, comment, posted, postedBy
      FROM \`${src}\`.tblLeadComments
      WHERE idComment > ?
        AND comment IS NOT NULL AND TRIM(comment) <> ''
      ORDER BY idComment
      LIMIT ?`,
      [cursor, limit]
    );
    if (!raw.length) {
      return { rows: [], nextAfterId: cursor, done: true };
    }

    cursor = Number(raw[raw.length - 1].idComment);
    const leadIds = [...new Set(raw.map((r) => r.IdLead))];
    const [existing] = await targetConn.query(
      `SELECT id_lead FROM \`${tgt}\`.\`lead\` WHERE id_lead IN (?)`,
      [leadIds]
    );
    const ok = new Set(existing.map((r) => Number(r.id_lead)));
    const kept = raw.filter((r) => ok.has(Number(r.IdLead)));
    if (kept.length) {
      return { rows: kept, nextAfterId: cursor, done: false };
    }
  }
  return { rows: [], nextAfterId: cursor, done: false };
}

async function insertCommentBatch(targetConn, rows, maps) {
  if (!rows.length) return 0;
  const db = config.target.database;
  const values = rows.map((r) => [
    r.idComment,
    r.IdLead,
    NOTE_TYPE,
    String(r.comment).trim(),
    r.posted,
    trimOrNull(r.postedBy),
    resolveUserId(maps, r.postedBy),
  ]);

  const ph = values.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
  const [result] = await targetConn.query(
    `INSERT IGNORE INTO \`${db}\`.\`${TABLE}\`
     (id_note, id_lead, note_type, body, posted_at, posted_by, posted_by_user_id)
     VALUES ${ph}`,
    values.flat()
  );
  return result.affectedRows ?? 0;
}

async function getResumeAfterId(targetConn) {
  const db = config.target.database;
  const [[row]] = await targetConn.query(
    `SELECT COALESCE(MAX(id_note), 0) AS afterId FROM \`${db}\`.\`${TABLE}\` WHERE note_type = ?`,
    [NOTE_TYPE]
  );
  return Number(row.afterId);
}

async function syncLeadComments(sourceConn, targetConn, maps, { truncate = true, resume = false, onProgress } = {}) {
  const db = config.target.database;
  const schemaPatched = await ensureCommentNoteType(targetConn);
  if (schemaPatched) {
    console.log('  ✓ lead_note.note_type + comment; snapshots re-numerados ≥4M');
  }

  if (truncate && !resume) {
    const deleted = await deleteCommentNotes(targetConn);
    if (deleted) console.log(`  ✓ comentarios previos eliminados: ${deleted}`);
  }

  const total = await countSourceComments(sourceConn, targetConn);
  let afterId = resume ? await getResumeAfterId(targetConn) : 0;
  if (resume && afterId > 0) {
    console.log(`  · resume desde idComment > ${afterId}`);
  }
  console.log(`  · tblLeadComments a migrar: ~${total}`);
  let inserted = 0;
  let scanned = 0;

  for (;;) {
    const { rows: batch, nextAfterId, done } = await fetchCommentBatch(sourceConn, targetConn, {
      afterId,
      limit: FLUSH_BATCH,
    });
    if (done && !batch.length) break;
    afterId = nextAfterId;
    if (!batch.length) continue;

    inserted += await insertCommentBatch(targetConn, batch, maps);
    scanned += batch.length;

    if (onProgress) onProgress({ scanned, inserted, total, afterId });
    else if (scanned % 40000 < FLUSH_BATCH) {
      console.log(`  · ${scanned} leídos (+${inserted} nuevos), idComment ≤ ${afterId}…`);
    }
  }

  const [[{ n }]] = await targetConn.query(
    `SELECT COUNT(*) AS n FROM \`${db}\`.\`${TABLE}\` WHERE note_type = ?`,
    [NOTE_TYPE]
  );
  console.log(`  ✓ lead_note (comment): ${n} filas (${inserted} nuevos en esta corrida)`);
  return { inserted, total: Number(n) };
}

module.exports = {
  TABLE,
  NOTE_TYPE,
  SNAPSHOT_NOTE_ID_BASE,
  syncLeadComments,
};
