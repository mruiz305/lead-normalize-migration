#!/usr/bin/env node
/** Índices Case Manager API sobre tablas normalizadas. Uso: npm run patch:case-manager-indexes */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

const INDEXES = [
  {
    table: 'lead',
    name: 'idx_cm_lead_status_created',
    ddl: 'ADD INDEX idx_cm_lead_status_created (id_lead_status, created_at)',
  },
  {
    table: 'lead',
    name: 'idx_cm_lead_hot_status',
    ddl: 'ADD INDEX idx_cm_lead_hot_status (is_hot_lead, id_lead_status)',
  },
  {
    table: 'lead',
    name: 'idx_cm_lead_requested_drop',
    ddl: 'ADD INDEX idx_cm_lead_requested_drop (requested_drop, id_lead_status)',
  },
  {
    table: 'lead_timeline',
    name: 'idx_cm_lt_locked_down',
    ddl: 'ADD INDEX idx_cm_lt_locked_down (date_locked_down)',
  },
  {
    table: 'lead_timeline',
    name: 'idx_cm_lt_dropped',
    ddl: 'ADD INDEX idx_cm_lt_dropped (date_dropped)',
  },
  {
    table: 'lead_party',
    name: 'idx_cm_party_primary',
    ddl: 'ADD INDEX idx_cm_party_primary (id_lead, is_primary_party)',
  },
  {
    table: 'lead_staff',
    name: 'idx_cm_staff_lead_kind',
    ddl: 'ADD INDEX idx_cm_staff_lead_kind (id_lead, id_staff_kind)',
  },
  {
    table: 'lead_note',
    name: 'idx_cm_note_lead_type',
    ddl: 'ADD INDEX idx_cm_note_lead_type (id_lead, note_type)',
  },
  {
    table: 'lead_org_snapshot',
    name: 'idx_cm_org_team',
    ddl: 'ADD INDEX idx_cm_org_team (team)',
  },
  {
    table: 'lead_org_snapshot',
    name: 'idx_cm_org_office',
    ddl: 'ADD INDEX idx_cm_org_office (office_legacy)',
  },
  {
    table: 'lead_org_snapshot',
    name: 'idx_cm_org_pod',
    ddl: 'ADD INDEX idx_cm_org_pod (pod)',
  },
  {
    table: 'lead_org_snapshot',
    name: 'idx_cm_org_region',
    ddl: 'ADD INDEX idx_cm_org_region (region)',
  },
  {
    table: 'lead_org_snapshot',
    name: 'idx_cm_org_directorate',
    ddl: 'ADD INDEX idx_cm_org_directorate (directorate)',
  },
];

async function indexExists(conn, db, table, name) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?
     LIMIT 1`,
    [db, table, name],
  );
  return rows.length > 0;
}

async function main() {
  const db = config.target.database;
  console.log(`Aplicando índices Case Manager en ${db}…\n`);

  await withTarget(async (conn) => {
    for (const idx of INDEXES) {
      if (await indexExists(conn, db, idx.table, idx.name)) {
        console.log(`  · ${idx.table}.${idx.name} (ya existe)`);
        continue;
      }
      const tableSql = idx.table === 'lead' ? '`lead`' : idx.table;
      await conn.query(`ALTER TABLE \`${db}\`.${tableSql} ${idx.ddl}`);
      console.log(`  ✓ ${idx.table}.${idx.name}`);
    }
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
