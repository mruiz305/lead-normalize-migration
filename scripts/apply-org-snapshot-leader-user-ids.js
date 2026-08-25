#!/usr/bin/env node
/**
 * Agrega *_user_id de líderes en lead_org_snapshot y backfill desde emails.
 * Uso: npm run patch:org-snapshot-leader-ids
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

const COLUMNS = [
  'directorate_user_id',
  'region_user_id',
  'office_user_id',
  'pod_user_id',
  'team_user_id',
  'duo_user_id',
];

async function columnExists(conn, db, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [db, table, column],
  );
  return rows.length > 0;
}

async function indexExists(conn, db, table, indexName) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [db, table, indexName],
  );
  return rows.length > 0;
}

async function main() {
  const db = config.target.database;
  console.log(`lead_org_snapshot leader user ids en ${db}…\n`);

  await withTarget(async (conn) => {
    for (const col of COLUMNS) {
      if (await columnExists(conn, db, 'lead_org_snapshot', col)) {
        console.log(`  · ${col} — ya existe`);
        continue;
      }
      const after = {
        directorate_user_id: 'directorate_name',
        region_user_id: 'region_name',
        office_user_id: 'office_legacy',
        pod_user_id: 'pod_name',
        team_user_id: 'team_name',
        duo_user_id: 'duo_name',
      }[col];
      await conn.query(
        `ALTER TABLE \`${db}\`.lead_org_snapshot
         ADD COLUMN \`${col}\` int DEFAULT NULL
         COMMENT 'app_user.id_user del líder al crear'
         AFTER \`${after}\``,
      );
      console.log(`  ✓ columna ${col}`);
    }

    const indexes = [
      ['idx_org_snapshot_region_user', 'region_user_id'],
      ['idx_org_snapshot_office_user', 'office_user_id'],
      ['idx_org_snapshot_pod_user', 'pod_user_id'],
      ['idx_org_snapshot_team_user', 'team_user_id'],
      ['idx_org_snapshot_duo_user', 'duo_user_id'],
      ['idx_org_snapshot_directorate_user', 'directorate_user_id'],
    ];
    for (const [name, col] of indexes) {
      if (await indexExists(conn, db, 'lead_org_snapshot', name)) {
        console.log(`  · índice ${name} — ya existe`);
        continue;
      }
      await conn.query(
        `ALTER TABLE \`${db}\`.lead_org_snapshot ADD KEY \`${name}\` (\`${col}\`)`,
      );
      console.log(`  ✓ índice ${name}`);
    }

    console.log('\nBackfill desde emails (join directo)…');
    const updates = [
      [
        'directorate_user_id',
        `UPDATE \`${db}\`.lead_org_snapshot org
         INNER JOIN \`${db}\`.app_user u ON u.email = org.directorate
         SET org.directorate_user_id = u.id_user
         WHERE org.directorate_user_id IS NULL`,
      ],
      [
        'region_user_id',
        `UPDATE \`${db}\`.lead_org_snapshot org
         INNER JOIN \`${db}\`.app_user u ON u.email = org.region
         SET org.region_user_id = u.id_user
         WHERE org.region_user_id IS NULL`,
      ],
      [
        'office_user_id',
        `UPDATE \`${db}\`.lead_org_snapshot org
         INNER JOIN \`${db}\`.app_user u ON u.email = org.office_legacy
         SET org.office_user_id = u.id_user
         WHERE org.office_user_id IS NULL`,
      ],
      [
        'office_user_id(office_code)',
        `UPDATE \`${db}\`.lead_org_snapshot org
         INNER JOIN \`${db}\`.app_user u ON u.email = org.office_code
         SET org.office_user_id = u.id_user
         WHERE org.office_user_id IS NULL`,
      ],
      [
        'pod_user_id',
        `UPDATE \`${db}\`.lead_org_snapshot org
         INNER JOIN \`${db}\`.app_user u ON u.email = org.pod
         SET org.pod_user_id = u.id_user
         WHERE org.pod_user_id IS NULL`,
      ],
      [
        'team_user_id',
        `UPDATE \`${db}\`.lead_org_snapshot org
         INNER JOIN \`${db}\`.app_user u ON u.email = org.team
         SET org.team_user_id = u.id_user
         WHERE org.team_user_id IS NULL`,
      ],
      [
        'duo_user_id',
        `UPDATE \`${db}\`.lead_org_snapshot org
         INNER JOIN \`${db}\`.app_user u ON u.email = org.duo
         SET org.duo_user_id = u.id_user
         WHERE org.duo_user_id IS NULL`,
      ],
    ];

    for (const [label, sql] of updates) {
      const started = Date.now();
      const [result] = await conn.query(sql);
      console.log(
        `  ✓ ${label} — affected ${result.affectedRows ?? '?'} (${Date.now() - started}ms)`,
      );
    }

    const [stats] = await conn.query(
      `SELECT
         COUNT(*) AS total,
         SUM(region_user_id IS NOT NULL) AS with_region,
         SUM(office_user_id IS NOT NULL) AS with_office,
         SUM(pod_user_id IS NOT NULL) AS with_pod,
         SUM(team_user_id IS NOT NULL) AS with_team
       FROM \`${db}\`.lead_org_snapshot`,
    );
    console.log('\nStats:', stats[0]);
  });

  await closeAll();
  console.log('\nListo. No hace falta re-migrar leads: backfill sobre snapshot existente.');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
