#!/usr/bin/env node
/** ref_state + client_address (N direcciones) + FK estados en lead_accident. */

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

async function fkExists(conn, db, table, fkName) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?
       AND CONSTRAINT_TYPE = 'FOREIGN KEY' LIMIT 1`,
    [db, table, fkName]
  );
  return rows.length > 0;
}

async function ensureCatalog(conn, db) {
  const sql = fs.readFileSync(
    path.join(config.sqlDir, 'patches', 'add_state_and_client_address.sql'),
    'utf8'
  );
  await conn.query(sql);
  console.log('  ✓ ref_state, ref_address_kind, client_address');
}

async function migrateClientLocation(conn, db) {
  if (!(await tableExists(conn, db, 'client_location'))) {
    console.log('  · client_location ya eliminada');
    return;
  }

  if (!(await tableExists(conn, db, 'client_address'))) {
    throw new Error('client_address no existe — ejecuta ensureCatalog primero');
  }

  const [[{ cnt: existing }]] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM \`${db}\`.client_address`
  );
  if (existing > 0) {
    console.log(`  · client_address ya tiene ${existing} filas — omitiendo copia`);
  } else {
    const [res] = await conn.query(`
      INSERT INTO \`${db}\`.client_address
        (id_client, id_address_kind, street, unit, city, id_state, postal_code, is_primary)
      SELECT
        cl.id_client,
        (SELECT id_address_kind FROM \`${db}\`.ref_address_kind WHERE kind_code = 'RESIDENCE' LIMIT 1),
        cl.street,
        cl.unit,
        cl.city,
        COALESCE(
          (SELECT gs.id_state FROM \`${db}\`.ref_state gs
           WHERE LOWER(gs.state_name) = LOWER(TRIM(cl.state_code)) LIMIT 1),
          (SELECT gs.id_state FROM \`${db}\`.ref_state gs
           WHERE gs.state_code = UPPER(TRIM(cl.state_code)) LIMIT 1)
        ),
        cl.postal_code,
        1
      FROM \`${db}\`.client_location cl
      WHERE COALESCE(TRIM(cl.street), TRIM(cl.unit), TRIM(cl.city), TRIM(cl.state_code), TRIM(cl.postal_code)) IS NOT NULL
    `);
    console.log(`  ✓ client_location → client_address (${res.affectedRows} filas)`);
  }

  await conn.query(`DROP TABLE \`${db}\`.client_location`);
  console.log('  ✓ drop client_location');
}

async function migrateLeadAccidentStates(conn, db) {
  const hasText = await columnExists(conn, db, 'lead_accident', 'accident_state');
  const hasFk = await columnExists(conn, db, 'lead_accident', 'id_accident_state');

  if (!hasFk) {
    await conn.query(`
      ALTER TABLE \`${db}\`.lead_accident
        ADD COLUMN id_accident_state smallint DEFAULT NULL COMMENT 'FK ref_state' AFTER date_of_accident,
        ADD COLUMN id_rep_state smallint DEFAULT NULL COMMENT 'FK ref_state' AFTER id_accident_state
    `);
    console.log('  ✓ lead_accident + id_accident_state, id_rep_state');
  }

  if (hasText) {
    await conn.query(`
      UPDATE \`${db}\`.lead_accident la
      SET la.id_accident_state = COALESCE(la.id_accident_state, (
        SELECT gs.id_state FROM \`${db}\`.ref_state gs
        WHERE LOWER(gs.state_name) = LOWER(TRIM(la.accident_state))
           OR gs.state_code = UPPER(TRIM(la.accident_state))
        LIMIT 1
      ))
      WHERE la.accident_state IS NOT NULL AND TRIM(la.accident_state) <> ''
    `);
    await conn.query(`
      UPDATE \`${db}\`.lead_accident la
      SET la.id_rep_state = COALESCE(la.id_rep_state, (
        SELECT gs.id_state FROM \`${db}\`.ref_state gs
        WHERE LOWER(gs.state_name) = LOWER(TRIM(la.rep_state))
           OR gs.state_code = UPPER(TRIM(la.rep_state))
        LIMIT 1
      ))
      WHERE la.rep_state IS NOT NULL AND TRIM(la.rep_state) <> ''
    `);
    console.log('  ✓ backfill id_accident_state / id_rep_state');

    await conn.query(`
      ALTER TABLE \`${db}\`.lead_accident
        DROP COLUMN accident_state,
        DROP COLUMN rep_state
    `);
    console.log('  ✓ drop accident_state / rep_state');
  } else if (hasFk) {
    console.log('  · lead_accident ya usa FK de estado');
  }

  if (!(await fkExists(conn, db, 'lead_accident', 'fk_lead_accident_state'))) {
    await conn.query(`
      ALTER TABLE \`${db}\`.lead_accident
        ADD KEY idx_lead_accident_state (id_accident_state),
        ADD KEY idx_lead_acc_rep_state (id_rep_state),
        ADD CONSTRAINT fk_lead_accident_state FOREIGN KEY (id_accident_state)
          REFERENCES \`${db}\`.ref_state (id_state),
        ADD CONSTRAINT fk_lead_acc_rep_state FOREIGN KEY (id_rep_state)
          REFERENCES \`${db}\`.ref_state (id_state)
    `);
    console.log('  ✓ FK lead_accident → ref_state');
  }
}

async function applyFlatView(conn) {
  const sql = fs.readFileSync(path.join(config.sqlDir, '03_view_tblLeads_flat.sql'), 'utf8');
  await conn.query(sql);
  console.log('  ✓ vista v_tblLeads_flat');
}

async function main() {
  const db = config.target.database;
  console.log(`Geo estado + client_address en ${db}…\n`);

  await withTarget(async (conn) => {
    await ensureCatalog(conn, db);
    await migrateClientLocation(conn, db);
    await migrateLeadAccidentStates(conn, db);
    try {
      await applyFlatView(conn);
    } catch (e) {
      console.log(`  ⚠ vista flat: ${e.message}`);
    }
  });

  await closeAll();
  console.log('\nListo. Direcciones N por client; estados vía ref_state.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
