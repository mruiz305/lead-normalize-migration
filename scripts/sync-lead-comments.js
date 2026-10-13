#!/usr/bin/env node
/**
 * tblLeadComments → lead_note (note_type=comment, identidad glide_comment_id).
 *
 *   npm run sync:lead-comments               resume (default): ids nuevos + solape 30 min
 *   npm run sync:lead-comments -- --full     recorre todo prod y upsertea (no borra)
 *   npm run sync:lead-comments -- --truncate borra los comentarios Glide y recarga
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { withTarget, withSource, closeAll } = require('../src/db');
const config = require('../src/config');
const { loadCatalogMaps } = require('../src/migration/maps');
const { syncLeadComments } = require('../src/migration/leadCommentSync');

async function main() {
  const truncate = process.argv.includes('--truncate');
  const full = process.argv.includes('--full');
  const resume = !truncate && !full;
  const db = config.target.database;
  const mode = truncate ? 'truncate + full' : full ? 'full (upsert)' : 'resume';
  console.log(`Comentarios de lead (${db}) [${mode}]…\n`);

  await withTarget(async (targetConn) => {
    const maps = await loadCatalogMaps(targetConn);
    await withSource(async (sourceConn) => {
      await syncLeadComments(sourceConn, targetConn, maps, { truncate, resume });
    });
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
