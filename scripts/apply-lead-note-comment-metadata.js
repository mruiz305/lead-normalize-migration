#!/usr/bin/env node
/** Columnas comment en lead_note (document_id, source, updated_at). npm run patch:lead-note-comment-metadata */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');

const COLUMNS = [
  { name: 'document_id', ddl: 'ADD COLUMN document_id varchar(512) DEFAULT NULL AFTER body' },
  { name: 'source', ddl: 'ADD COLUMN source varchar(128) DEFAULT NULL AFTER document_id' },
  { name: 'updated_at', ddl: 'ADD COLUMN updated_at datetime(3) DEFAULT NULL AFTER posted_at' },
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
