#!/usr/bin/env node
/** mentions + recipient_user_ids en lead_note (chat). npm run patch:lead-note-comment-chat-fields */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { withTarget, closeAll } = require('../src/db');

const COLUMNS = [
  {
    name: 'mentions',
    ddl: "ADD COLUMN mentions json DEFAULT NULL COMMENT '@user ids mencionados' AFTER source",
  },
  {
    name: 'recipient_user_ids',
    ddl: "ADD COLUMN recipient_user_ids json DEFAULT NULL COMMENT 'destinatarios notificación' AFTER mentions",
  },
];

async function columnExists(conn, db, column) {
  const [rows] = await conn.query(
    `SELECT 1 AS ok FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'lead_note' AND COLUMN_NAME = ?`,
    [db, column],
  );
  return Boolean(rows[0]);
}

async function main() {
  const config = require('../src/config');
  const db = config.target.database;
  console.log(`lead_note chat fields (mentions, recipient_user_ids) en ${db}…\n`);

  await withTarget(async (conn) => {
    for (const col of COLUMNS) {
      if (await columnExists(conn, db, col.name)) {
        console.log(`  skip lead_note.${col.name} (exists)`);
        continue;
      }
      await conn.query(`ALTER TABLE \`${db}\`.lead_note ${col.ddl}`);
      console.log(`  ✓ lead_note.${col.name}`);
    }
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
