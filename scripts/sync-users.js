#!/usr/bin/env node
/**
 * Sync g_users → app_user (llave: rowId / legacy_row_id).
 * Una fila app_user por Glide rowId. Email se actualiza; no decide alta/edición.
 *
 * Uso:
 *   npm run sync:users
 *   npm run sync:users -- --dry-run
 *   npm run sync:users -- --active-only   (solo altas Active; no espejo completo)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const config = require('../src/config');
const { withTarget, withSource, closeAll } = require('../src/db');
const { upsertAppUsersFromGUsers } = require('../src/migration/appUserSync');
const { populateHierarchyMembership } = require('../src/migration/hierarchyMembership');
const { syncUserChannelsFromGUsers } = require('../src/migration/userChannelSync');

async function tableExists(conn, db, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
    [db, table]
  );
  return rows.length > 0;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const activeOnlyInserts = process.argv.includes('--active-only');
  const skipHierarchy = process.argv.includes('--skip-hierarchy');
  const skipChannels = process.argv.includes('--skip-channels');

  console.log('sync:users — g_users → app_user (rowId)');
  console.log(`  Origen:  ${config.source.host}/${config.source.database}`);
  console.log(`  Destino: ${config.target.host}/${config.target.database}`);
  console.log(`  Modo:    ${dryRun ? 'dry-run' : 'LIVE'}`);
  console.log(
    `  Altas:   ${activeOnlyInserts ? 'solo Active (--active-only)' : 'todas (espejo prod g_users)'}\n`
  );

  await withTarget(async (targetConn) => {
    await withSource(async (sourceConn) => {
      const stats = await upsertAppUsersFromGUsers(sourceConn, targetConn, {
        dryRun,
        activeOnlyInserts,
      });
      console.log(`  g_users filas:     ${stats.sourceRows} (${stats.duplicateRowIds} rowId duplicados)`);
      console.log(`  → app_user target: ${stats.canonical} por rowId (${stats.activeCanonical} Active)`);
      console.log(`  nuevos:            ${stats.inserted}`);
      console.log(`  actualizados:      ${stats.updated}`);
      if (stats.skippedNoEmail) {
        console.log(`  omitidos (sin email): ${stats.skippedNoEmail}`);
      }
      if (stats.remappedIds) {
        console.log(`  id_user reasignados (PK ocupada): ${stats.remappedIds}`);
      }
      if (stats.schema?.changes?.length) {
        console.log(`  schema:            ${stats.schema.changes.join(', ')}`);
      }
      if (stats.skippedTermedNew) {
        console.log(`  omitidos (Termed nuevos): ${stats.skippedTermedNew}`);
      }
      if (!dryRun) {
        console.log(`  app_user:    ${stats.beforeCount} → ${stats.afterCount}`);
        if (stats.subOfficeCatalog) {
          console.log(
            `  ref_sub_office: ${stats.subOfficeCatalog.sourceDistinct} códigos prod` +
              (stats.subOfficeCatalog.inserted
                ? ` (+${stats.subOfficeCatalog.inserted} nuevos)`
                : ' (sin altas)')
          );
        }
      }

      if (dryRun) {
        console.log('\n(dry-run) no se actualizó hierarchy ni channels');
        return;
      }

      if (!skipHierarchy) {
        console.log('\n  hierarchy_membership…');
        await populateHierarchyMembership(sourceConn, targetConn, { truncate: true });
      }

      if (!skipChannels) {
        const tgt = config.target.database;
        if (await tableExists(targetConn, tgt, 'user_channel')) {
          console.log('  user_channel…');
          const chStats = await syncUserChannelsFromGUsers(sourceConn, targetConn, { truncate: true });
          console.log(
            `  ✓ user_channel: ${chStats.total} filas (${chStats.channelRows} desde g_users)`
          );
        } else {
          console.log('  ⚠ user_channel no existe — omitido');
        }
      }
    });
  });

  console.log('\n✓ sync:users listo');
}

main()
  .catch((e) => {
    console.error('\nError:', e.message || e);
    process.exitCode = 1;
  })
  .finally(() => closeAll());
