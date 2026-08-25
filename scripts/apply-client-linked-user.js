#!/usr/bin/env node
/** client.id_linked_user → app_user; backfill por email/teléfono vs app_user. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');
const { normalizePhoneForMatch } = require('../src/migration/clientLink');

const BATCH = 50;

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

async function applyDdl(conn, db) {
  if (await columnExists(conn, db, 'client', 'id_linked_user')) {
    console.log('  · client.id_linked_user ya existe');
    return;
  }

  const ddl = fs.readFileSync(
    path.join(config.sqlDir, 'patches/add_client_linked_user.sql'),
    'utf8'
  );
  for (const stmt of ddl.split(';').map((s) => s.trim()).filter(Boolean)) {
    await conn.query(stmt);
  }
  console.log('  ✓ client + id_linked_user, FK app_user');
}

async function batchUpdateLinked(conn, db, pairs) {
  let n = 0;
  for (let i = 0; i < pairs.length; i += BATCH) {
    const chunk = pairs.slice(i, i + BATCH);
    const cases = chunk.map(() => 'WHEN ? THEN ?').join(' ');
    const ids = chunk.map(([idClient]) => idClient);
    const params = chunk.flatMap(([idClient, idUser]) => [idClient, idUser]);
    const sql = `UPDATE \`${db}\`.client
       SET id_linked_user = CASE id_client ${cases} END
       WHERE id_client IN (${ids.map(() => '?').join(',')}) AND id_linked_user IS NULL`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await conn.query(sql, [...params, ...ids]);
        break;
      } catch (e) {
        if (!['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(e.code) || attempt === 4) throw e;
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    n += chunk.length;
  }
  return n;
}

async function backfillByEmail(conn, db) {
  const [rows] = await conn.query(`
    SELECT c.id_client, MIN(u.id_user) AS id_user
    FROM \`${db}\`.client c
    INNER JOIN \`${db}\`.client_channel cc ON cc.id_client = c.id_client AND cc.is_primary = 1
    INNER JOIN \`${db}\`.ref_contact_channel_type ct
      ON ct.id_channel_type = cc.id_channel_type AND ct.medium_code = 'EMAIL'
    INNER JOIN \`${db}\`.app_user u ON LOWER(TRIM(u.email)) = LOWER(TRIM(cc.channel_value))
    WHERE c.id_linked_user IS NULL
      AND u.email IS NOT NULL AND TRIM(u.email) <> ''
    GROUP BY c.id_client
  `);
  const n = await batchUpdateLinked(conn, db, rows.map((r) => [r.id_client, r.id_user]));
  console.log(`  ✓ backfill email: ${n} filas`);
}

async function backfillByPhone(conn, db) {
  const [users] = await conn.query(`
    SELECT id_user, phone FROM \`${db}\`.app_user WHERE phone IS NOT NULL AND TRIM(phone) <> ''
  `);
  const userByPhone = new Map();
  for (const u of users) {
    const p = normalizePhoneForMatch(u.phone);
    if (p && !userByPhone.has(p)) userByPhone.set(p, u.id_user);
  }
  if (!userByPhone.size) {
    console.log('  · backfill teléfono: sin app_user con teléfono');
    return;
  }

  const [clients] = await conn.query(`
    SELECT c.id_client, cc.channel_value
    FROM \`${db}\`.client c
    INNER JOIN \`${db}\`.client_channel cc ON cc.id_client = c.id_client
    INNER JOIN \`${db}\`.ref_contact_channel_type ct
      ON ct.id_channel_type = cc.id_channel_type AND ct.medium_code = 'PHONE'
    WHERE c.id_linked_user IS NULL AND cc.channel_value IS NOT NULL AND TRIM(cc.channel_value) <> ''
  `);

  const pairs = [];
  const seen = new Set();
  for (const row of clients) {
    if (seen.has(row.id_client)) continue;
    const p = normalizePhoneForMatch(row.channel_value);
    if (!p) continue;
    const uid = userByPhone.get(p);
    if (!uid) continue;
    seen.add(row.id_client);
    pairs.push([row.id_client, uid]);
  }

  const n = await batchUpdateLinked(conn, db, pairs);
  console.log(`  ✓ backfill teléfono: ${n} filas`);
}

async function report(conn, db) {
  const [[{ linked }]] = await conn.query(`
    SELECT COUNT(*) AS linked FROM \`${db}\`.client WHERE id_linked_user IS NOT NULL
  `);
  const [[{ total }]] = await conn.query(`SELECT COUNT(*) AS total FROM \`${db}\`.client`);
  console.log(`\n  client con id_linked_user: ${linked} / ${total}`);
}

async function main() {
  const db = config.target.database;
  const skipBackfill = process.argv.includes('--skip-backfill');
  console.log(`client.id_linked_user en ${db}…\n`);

  await withTarget(async (conn) => {
    await applyDdl(conn, db);
    if (!(await fkExists(conn, db, 'client', 'fk_client_linked_user'))) {
      await conn.query(`
        ALTER TABLE \`${db}\`.client
          ADD CONSTRAINT fk_client_linked_user FOREIGN KEY (id_linked_user)
            REFERENCES \`${db}\`.app_user (id_user)
      `);
    }
    if (skipBackfill) {
      console.log('  · backfill omitido (--skip-backfill)');
    } else {
      await backfillByEmail(conn, db);
      await backfillByPhone(conn, db);
    }
    await report(conn, db);
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
