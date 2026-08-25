#!/usr/bin/env node
/** tblLeadComments → lead_note (note_type=comment). npm run sync:lead-comments */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { withTarget, withSource, closeAll } = require('../src/db');
const config = require('../src/config');
const { loadCatalogMaps } = require('../src/migration/maps');
const { syncLeadComments } = require('../src/migration/leadCommentSync');

async function main() {
  const truncate = !process.argv.includes('--no-truncate');
  const resume = process.argv.includes('--resume');
  const db = config.target.database;
  const mode = resume ? 'resume' : truncate ? 'full' : 'append';
  console.log(`Comentarios de lead (${db}) [${mode}]…\n`);

  await withTarget(async (targetConn) => {
    const maps = await loadCatalogMaps(targetConn);
    await withSource(async (sourceConn) => {
      await syncLeadComments(sourceConn, targetConn, maps, {
        truncate: truncate && !resume,
        resume,
      });
    });
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
