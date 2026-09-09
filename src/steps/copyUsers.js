const config = require('../config');
const { withTarget, withSource } = require('../db');
const { populateHierarchyMembership } = require('../migration/hierarchyMembership');
const { syncUserHrPeriod } = require('../migration/userHrPeriod');
const { syncUserChannelsFromGUsers } = require('../migration/userChannelSync');
const { upsertAppUsersFromGUsers } = require('../migration/appUserSync');

async function tableExists(conn, db, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
    [db, table]
  );
  return rows.length > 0;
}

async function runCopyUsers({ dryRun = false } = {}) {
  console.log(`Copiando g_users → app_user (${config.source.database} → ${config.target.database})`);

  if (dryRun) {
    console.log('  (dry-run) Se copiarían usuarios por rowId');
    return;
  }

  await withTarget(async (targetConn) => {
    await withSource(async (sourceConn) => {
      const tgt = config.target.database;

      await targetConn.query('SET FOREIGN_KEY_CHECKS = 0');
      if (await tableExists(targetConn, tgt, 'user_hr_period')) {
        await targetConn.query(`TRUNCATE TABLE \`${tgt}\`.user_hr_period`);
      }
      await targetConn.query(`TRUNCATE TABLE \`${tgt}\`.hierarchy_membership`);
      if (await tableExists(targetConn, tgt, 'user_channel')) {
        await targetConn.query(`TRUNCATE TABLE \`${tgt}\`.user_channel`);
      }
      await targetConn.query(`TRUNCATE TABLE \`${tgt}\`.app_user`);
      await targetConn.query('SET FOREIGN_KEY_CHECKS = 1');

      const stats = await upsertAppUsersFromGUsers(sourceConn, targetConn);
      console.log(
        `  ✓ app_user: ${stats.inserted} filas (${stats.sourceRows} g_users, ${stats.skippedNoEmail} sin email)`
      );
      if (stats.duplicateRowIds) {
        console.log(`  ⚠ ${stats.duplicateRowIds} rowId duplicados en origen — se conservó el id más alto`);
      }

      console.log('  Histórico HR (user_hr_period)…');
      await syncUserHrPeriod(sourceConn, targetConn, { truncate: true });

      console.log('  Poblando hierarchy_membership…');
      await populateHierarchyMembership(sourceConn, targetConn, { truncate: true });

      console.log('  Contactos staff (user_channel)…');
      if (await tableExists(targetConn, tgt, 'user_channel')) {
        const chStats = await syncUserChannelsFromGUsers(sourceConn, targetConn, { truncate: true });
        console.log(`  ✓ user_channel: ${chStats.total} filas (${chStats.channelRows} desde g_users)`);
      } else {
        console.log('  ⚠ user_channel no existe — ejecutar npm run patch:user-channel');
      }
    });
  });
}

module.exports = { runCopyUsers };
