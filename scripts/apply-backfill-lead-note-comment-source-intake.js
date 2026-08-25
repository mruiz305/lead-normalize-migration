#!/usr/bin/env node
/** lead_note comment: source NULL → case-manager (Intake). npm run patch:backfill-lead-note-comment-source-intake */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

async function countPending(conn, db) {
  const [[row]] = await conn.query(
    `SELECT COUNT(*) AS n
     FROM \`${db}\`.lead_note
     WHERE note_type = 'comment'
       AND (source IS NULL OR TRIM(source) = '')`,
  );
  return Number(row.n);
}

async function main() {
  const db = config.target.database;
  console.log(`Backfill lead_note.source = case-manager en ${db}…\n`);

  await withTarget(async (conn) => {
    const pending = await countPending(conn, db);
    console.log(`  Comentarios sin source: ${pending.toLocaleString()}`);

    if (pending === 0) {
      console.log('  skip (nada que actualizar)');
      return;
    }

    const sql = fs.readFileSync(
      path.join(
        config.sqlDir,
        'patches',
        'backfill_lead_note_comment_source_intake.sql',
      ),
      'utf8',
    );
    const [result] = await conn.query(sql);
    const updated = result.affectedRows ?? pending;

    const remaining = await countPending(conn, db);
    const [[totals]] = await conn.query(
      `SELECT
         COUNT(*) AS total_comments,
         SUM(source = 'case-manager') AS intake_source
       FROM \`${db}\`.lead_note
       WHERE note_type = 'comment'`,
    );

    console.log(`  ✓ actualizados: ${updated.toLocaleString()}`);
    console.log(`  ✓ sin source restantes: ${remaining.toLocaleString()}`);
    console.log(
      `  ✓ comentarios totales: ${Number(totals.total_comments).toLocaleString()} (${Number(totals.intake_source).toLocaleString()} con case-manager)`,
    );
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
