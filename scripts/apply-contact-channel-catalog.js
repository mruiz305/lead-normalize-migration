#!/usr/bin/env node
/** Catálogo ref_contact_channel_type + migración client_channel (enum → id_channel_type). */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

async function tableExists(conn, db, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
    [db, table]
  );
  return rows.length > 0;
}

async function columnExists(conn, db, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [db, table, column]
  );
  return rows.length > 0;
}

async function indexExists(conn, db, table, indexName) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [db, table, indexName]
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

async function dropIndexIfExists(conn, db, table, indexName) {
  if (await indexExists(conn, db, table, indexName)) {
    await conn.query(`ALTER TABLE \`${db}\`.\`${table}\` DROP INDEX \`${indexName}\``);
    console.log(`  ✓ drop index ${table}.${indexName}`);
  }
}

async function ensureCatalog(conn, db) {
  if (!(await tableExists(conn, db, 'ref_contact_channel_type'))) {
    const sql = fs.readFileSync(
      path.join(config.sqlDir, 'patches', 'add_contact_channel_catalog.sql'),
      'utf8'
    );
    await conn.query(sql);
    console.log('  ✓ catálogo ref_contact_channel_type');
  } else {
    console.log('  · catálogo contacto ya existe');
  }
}

async function migrateClientChannel(conn, db) {
  if (!(await columnExists(conn, db, 'client_channel', 'channel_type'))) {
    if (await columnExists(conn, db, 'client_channel', 'id_channel_type')) {
      console.log('  · client_channel ya migrado');
    }
    return;
  }

  if (!(await columnExists(conn, db, 'client_channel', 'id_channel_type'))) {
    await conn.query(`
      ALTER TABLE \`${db}\`.client_channel
        ADD COLUMN id_channel_type smallint DEFAULT NULL AFTER id_client,
        ADD COLUMN is_active tinyint(1) NOT NULL DEFAULT 1 AFTER is_primary,
        ADD COLUMN created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER is_active
    `);
    console.log('  ✓ client_channel + id_channel_type, is_active, created_at');
  }

  await conn.query(`
    UPDATE \`${db}\`.client_channel cc
    INNER JOIN \`${db}\`.ref_contact_channel_type ct ON ct.type_code = CASE
      WHEN cc.channel_type = 'phone' AND cc.source_tag = 'original' THEN 'PHONE_INTAKE_RAW'
      WHEN cc.channel_type = 'phone' AND cc.source_tag = 'formatted' THEN 'PHONE_INTAKE_FORMATTED'
      WHEN cc.channel_type = 'phone' THEN 'PHONE_MOBILE'
      WHEN cc.channel_type = 'email' THEN 'EMAIL_PERSONAL'
      ELSE 'PHONE_OTHER'
    END
    SET cc.id_channel_type = ct.id_channel_type
    WHERE cc.id_channel_type IS NULL
  `);
  console.log('  ✓ backfill id_channel_type');

  if (await fkExists(conn, db, 'client_channel', 'fk_channel_client')) {
    await conn.query(`ALTER TABLE \`${db}\`.client_channel DROP FOREIGN KEY fk_channel_client`);
    console.log('  ✓ drop fk_channel_client');
  }

  await dropIndexIfExists(conn, db, 'client_channel', 'uk_client_channel');
  await dropIndexIfExists(conn, db, 'client_channel', 'idx_channel_lookup');

  await conn.query(`
    ALTER TABLE \`${db}\`.client_channel
      DROP COLUMN channel_type,
      DROP COLUMN source_tag,
      MODIFY COLUMN id_channel_type smallint NOT NULL,
      MODIFY COLUMN channel_label varchar(100) DEFAULT NULL
  `);
  console.log('  ✓ drop channel_type / source_tag');

  if (!(await indexExists(conn, db, 'client_channel', 'uk_client_channel'))) {
    await conn.query(`
      ALTER TABLE \`${db}\`.client_channel
        ADD UNIQUE KEY uk_client_channel (id_client, id_channel_type, channel_value(191)),
        ADD KEY idx_client_channel_type (id_channel_type)
    `);
  }

  if (!(await fkExists(conn, db, 'client_channel', 'fk_channel_client'))) {
    await conn.query(`
      ALTER TABLE \`${db}\`.client_channel
        ADD CONSTRAINT fk_channel_client FOREIGN KEY (id_client) REFERENCES \`${db}\`.client (id_client)
    `);
  }
  if (!(await fkExists(conn, db, 'client_channel', 'fk_channel_type'))) {
    await conn.query(`
      ALTER TABLE \`${db}\`.client_channel
        ADD CONSTRAINT fk_channel_type FOREIGN KEY (id_channel_type)
          REFERENCES \`${db}\`.ref_contact_channel_type (id_channel_type)
    `);
  }
  console.log('  ✓ client_channel migrado a id_channel_type');
}

async function applyFlatView(conn) {
  const sql = fs.readFileSync(path.join(config.sqlDir, '03_view_tblLeads_flat.sql'), 'utf8');
  await conn.query(sql);
  console.log('  ✓ vista v_tblLeads_flat');
}

async function main() {
  const db = config.target.database;
  console.log(`Catálogo contacto + client_channel en ${db}…\n`);

  await withTarget(async (conn) => {
    await ensureCatalog(conn, db);
    await migrateClientChannel(conn, db);
    try {
      await applyFlatView(conn);
    } catch (e) {
      console.log(`  ⚠ vista flat: ${e.message}`);
    }
  });

  await closeAll();
  console.log('\nListo. Nuevas migraciones usan ref_contact_channel_type.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
