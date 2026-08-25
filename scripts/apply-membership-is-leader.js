#!/usr/bin/env node
/** Migra hierarchy_membership: role_name → is_leader y repuebla desde g_users. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { withTarget, withSource, closeAll } = require('../src/db');
const config = require('../src/config');
const { populateHierarchyMembership } = require('../src/migration/hierarchyMembership');

async function columnExists(conn, db, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [db, table, column]
  );
  return rows.length > 0;
}

async function tableExists(conn, db, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
    [db, table]
  );
  return rows.length > 0;
}

async function recreateMembershipTable(conn, db) {
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  await conn.query(`DROP TABLE IF EXISTS \`${db}\`.hierarchy_membership`);
  await conn.query(`
    CREATE TABLE \`${db}\`.hierarchy_membership (
      membership_id int NOT NULL AUTO_INCREMENT,
      user_id int NOT NULL COMMENT 'app_user.id_user',
      id_hierarchy_level tinyint NOT NULL,
      id_company_office int DEFAULT NULL COMMENT 'Solo nivel OFFICE — FK catálogo',
      leader_user_id int DEFAULT NULL COMMENT 'Jefe en este nivel (pod/team/duo…)',
      is_leader tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = jefe en id_hierarchy_level; 0 = miembro',
      is_primary tinyint(1) NOT NULL DEFAULT 0,
      start_date date DEFAULT NULL,
      end_date date DEFAULT NULL,
      is_active tinyint(1) NOT NULL DEFAULT 1,
      synced_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (membership_id),
      UNIQUE KEY uk_hierarchy_membership (user_id, id_hierarchy_level, id_company_office, leader_user_id, is_leader),
      KEY idx_hm_user (user_id),
      KEY idx_hm_level (id_hierarchy_level),
      KEY idx_hm_company_office (id_company_office),
      KEY idx_hm_leader (leader_user_id),
      KEY idx_hm_is_leader (is_leader),
      CONSTRAINT fk_hm_user FOREIGN KEY (user_id) REFERENCES app_user (id_user),
      CONSTRAINT fk_hm_level FOREIGN KEY (id_hierarchy_level) REFERENCES hierarchy_level (id_hierarchy_level),
      CONSTRAINT fk_hm_company_office FOREIGN KEY (id_company_office) REFERENCES ref_company_office (id_company_office),
      CONSTRAINT fk_hm_leader FOREIGN KEY (leader_user_id) REFERENCES app_user (id_user)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      COMMENT='Pertenencia jerárquica por ID (office) o por leader (pod/team)'
  `);
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('  ✓ hierarchy_membership recreada con is_leader');
}

async function migrateSchema(conn, db) {
  if (!(await tableExists(conn, db, 'hierarchy_membership'))) {
    await recreateMembershipTable(conn, db);
    return true;
  }

  const hasRoleName = await columnExists(conn, db, 'hierarchy_membership', 'role_name');
  const hasIsLeader = await columnExists(conn, db, 'hierarchy_membership', 'is_leader');

  if (!hasRoleName && hasIsLeader) {
    console.log('  · is_leader ya aplicado');
    return false;
  }

  await recreateMembershipTable(conn, db);
  return true;
}

async function main() {
  const db = config.target.database;
  console.log(`Migrando hierarchy_membership → is_leader en ${db}…\n`);

  await withTarget(async (targetConn) => {
    await migrateSchema(targetConn, db);
  });

  console.log('\nRepoblando hierarchy_membership desde g_users…');
  await withTarget(async (targetConn) => {
    await withSource(async (sourceConn) => {
      await populateHierarchyMembership(sourceConn, targetConn, { truncate: true });
    });
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
