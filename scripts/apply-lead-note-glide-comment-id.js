#!/usr/bin/env node
/**
 * lead_note.glide_comment_id: identidad de origen de los comentarios de Glide,
 * separada de la PK local. Marca los ya copiados y los reapunta al lead
 * correcto (por lead.glide_id). Idempotente: si la columna existe no hace nada.
 * sync:lead-comments lo aplica solo si falta; este script es para correrlo
 * a mano y ver el resultado.
 *
 *   npm run patch:lead-note-glide-comment-id
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { withTarget, withSource, closeAll } = require('../src/db');
const { ensureGlideCommentId } = require('../src/migration/leadCommentSync');

async function main() {
  await withTarget(async (targetConn) => {
    await withSource(async (sourceConn) => {
      const r = await ensureGlideCommentId(sourceConn, targetConn);
      if (!r.patched) {
        console.log('lead_note.glide_comment_id ya existe — nada que hacer');
        return;
      }
      console.log(`✓ columna creada · techo prod idComment=${r.prodMax}`);
      console.log(`  comentarios Glide marcados:     ${r.tagged}`);
      console.log(`  reapuntados al lead correcto:   ${r.relinked}`);
      console.log(`  sin lead en el modelo:          ${r.unresolved}`);
    });
  });
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
  })
  .finally(() => closeAll());
