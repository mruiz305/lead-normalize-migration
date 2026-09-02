#!/usr/bin/env node
/**
 * Quita app_user Termed/inactivos que no están referenciados en leads ni org.
 * Útil tras un sync:users que insertó histórico Termed por error.
 *
 *   npm run prune:app-user-termed -- --dry-run
 *   npm run prune:app-user-termed
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const config = require('../src/config');
const { withTarget, closeAll } = require('../src/db');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const db = config.target.database;

  await withTarget(async (conn) => {
    const [[{ candidates }]] = await conn.query(`
      SELECT COUNT(*) AS candidates
      FROM \`${db}\`.app_user u
      WHERE u.is_active = 0
        AND NOT EXISTS (
          SELECT 1 FROM \`${db}\`.\`lead\` l
          WHERE l.submitter_user_id = u.id_user
             OR l.created_by_user_id = u.id_user
             OR l.updated_by_user_id = u.id_user
        )
        AND NOT EXISTS (
          SELECT 1 FROM \`${db}\`.lead_staff s WHERE s.id_user = u.id_user
        )
        AND NOT EXISTS (
          SELECT 1 FROM \`${db}\`.hierarchy_membership h
          WHERE h.user_id = u.id_user OR h.leader_user_id = u.id_user
        )
    `);

    console.log(`prune:app-user-termed (${dryRun ? 'dry-run' : 'LIVE'})`);
    console.log(`  candidatos inactivos sin referencias: ${candidates}`);

    if (dryRun || !candidates) return;

    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    const [r] = await conn.query(`
      DELETE u FROM \`${db}\`.app_user u
      WHERE u.is_active = 0
        AND NOT EXISTS (
          SELECT 1 FROM \`${db}\`.\`lead\` l
          WHERE l.submitter_user_id = u.id_user
             OR l.created_by_user_id = u.id_user
             OR l.updated_by_user_id = u.id_user
        )
        AND NOT EXISTS (
          SELECT 1 FROM \`${db}\`.lead_staff s WHERE s.id_user = u.id_user
        )
        AND NOT EXISTS (
          SELECT 1 FROM \`${db}\`.hierarchy_membership h
          WHERE h.user_id = u.id_user OR h.leader_user_id = u.id_user
        )
    `);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log(`  ✓ eliminados: ${r.affectedRows}`);
  });
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
  })
  .finally(() => closeAll());
