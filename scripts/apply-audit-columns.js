#!/usr/bin/env node
/** Auditoría estándar: client*, user_access_grant; limpia created_by/updated_by en lead. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

async function columnExists(conn, db, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [db, table, column]
  );
  return rows.length > 0;
}

async function fkExists(conn, db, table, fkName) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?
       AND CONSTRAINT_TYPE = 'FOREIGN KEY' LIMIT 1`,
    [db, table, fkName]
  );
  return rows.length > 0;
}

async function addEntityAudit(conn, db, table) {
  if (await columnExists(conn, db, table, 'updated_at')) {
    console.log(`  · ${table} ya tiene auditoría`);
    return;
  }

  await conn.query(`
    ALTER TABLE \`${db}\`.\`${table}\`
      ADD COLUMN updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
      ADD COLUMN created_by_user_id int DEFAULT NULL AFTER updated_at,
      ADD COLUMN updated_by_user_id int DEFAULT NULL AFTER created_by_user_id
  `);

  const idxCre = `idx_${table === 'client_channel' ? 'channel' : table === 'client_address' ? 'address' : table}_created_by`;
  const idxUpd = `idx_${table === 'client_channel' ? 'channel' : table === 'client_address' ? 'address' : table}_updated_by`;
  const fkCre = `fk_${table === 'client' ? 'client' : table === 'client_channel' ? 'channel' : 'address'}_created_by`;
  const fkUpd = `fk_${table === 'client' ? 'client' : table === 'client_channel' ? 'channel' : 'address'}_updated_by`;

  await conn.query(`
    ALTER TABLE \`${db}\`.\`${table}\`
      ADD KEY \`${idxCre}\` (created_by_user_id),
      ADD KEY \`${idxUpd}\` (updated_by_user_id)
  `);

  if (!(await fkExists(conn, db, table, fkCre))) {
    await conn.query(`
      ALTER TABLE \`${db}\`.\`${table}\`
        ADD CONSTRAINT \`${fkCre}\` FOREIGN KEY (created_by_user_id) REFERENCES \`${db}\`.app_user (id_user),
        ADD CONSTRAINT \`${fkUpd}\` FOREIGN KEY (updated_by_user_id) REFERENCES \`${db}\`.app_user (id_user)
    `);
  }
  console.log(`  ✓ ${table} + updated_at, *_by_user_id`);
}

async function backfillClientAudit(conn, db) {
  await conn.query(`
    UPDATE \`${db}\`.client c
    INNER JOIN \`${db}\`.lead_party lp ON lp.id_client = c.id_client
    INNER JOIN \`${db}\`.\`lead\` l ON l.id_lead = lp.id_lead
    SET
      c.created_by_user_id = COALESCE(c.created_by_user_id, l.created_by_user_id),
      c.updated_by_user_id = COALESCE(c.updated_by_user_id, l.updated_by_user_id, l.created_by_user_id),
      c.updated_at = COALESCE(l.updated_at, c.created_at)
    WHERE c.created_by_user_id IS NULL OR c.updated_by_user_id IS NULL
  `);

  for (const child of ['client_channel', 'client_address']) {
    await conn.query(`
      UPDATE \`${db}\`.\`${child}\` t
      INNER JOIN \`${db}\`.client c ON c.id_client = t.id_client
      SET
        t.created_by_user_id = c.created_by_user_id,
        t.updated_by_user_id = c.updated_by_user_id,
        t.updated_at = c.updated_at
      WHERE t.created_by_user_id IS NULL
    `);
  }
  console.log('  ✓ backfill client / channel / address');
}

async function patchUserAccessGrant(conn, db) {
  if (!(await columnExists(conn, db, 'user_access_grant', 'updated_at'))) {
    await conn.query(`
      ALTER TABLE \`${db}\`.user_access_grant
        ADD COLUMN updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
        ADD COLUMN updated_by_user_id int DEFAULT NULL AFTER granted_by_user_id,
        ADD KEY idx_grant_updated_by (updated_by_user_id)
    `);
    if (!(await fkExists(conn, db, 'user_access_grant', 'fk_grant_updated_by'))) {
      await conn.query(`
        ALTER TABLE \`${db}\`.user_access_grant
          ADD CONSTRAINT fk_grant_updated_by FOREIGN KEY (updated_by_user_id)
            REFERENCES \`${db}\`.app_user (id_user)
      `);
    }
    console.log('  ✓ user_access_grant + updated_at, updated_by_user_id');
  }

  await conn.query(`
    UPDATE \`${db}\`.user_access_grant
    SET updated_by_user_id = COALESCE(updated_by_user_id, granted_by_user_id),
        updated_at = COALESCE(updated_at, created_at)
    WHERE updated_by_user_id IS NULL
  `);
}

async function cleanLeadLegacy(conn, db) {
  if (!(await columnExists(conn, db, 'lead', 'created_by'))) {
    console.log('  · lead sin columnas legacy');
    return;
  }
  await conn.query(`
    ALTER TABLE \`${db}\`.\`lead\`
      DROP COLUMN created_by,
      DROP COLUMN updated_by
  `);
  console.log('  ✓ lead: drop created_by / updated_by');
}

async function applyFlatView(conn) {
  const sql = fs.readFileSync(path.join(config.sqlDir, '03_view_tblLeads_flat.sql'), 'utf8');
  await conn.query(sql);
  console.log('  ✓ vista v_tblLeads_flat');
}

async function main() {
  const db = config.target.database;
  console.log(`Auditoría estándar en ${db}…\n`);

  await withTarget(async (conn) => {
    for (const t of ['client', 'client_channel', 'client_address']) {
      await addEntityAudit(conn, db, t);
    }
    await backfillClientAudit(conn, db);
    await patchUserAccessGrant(conn, db);
    await cleanLeadLegacy(conn, db);
    try {
      await applyFlatView(conn);
    } catch (e) {
      console.log(`  ⚠ vista flat: ${e.message}`);
    }
  });

  await closeAll();
  console.log('\nListo. Entidades editables con created/updated + FK usuario; lead sin texto legacy.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
