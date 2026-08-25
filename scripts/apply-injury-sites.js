#!/usr/bin/env node
/** lead_injury: ref_injury_site N:M, sparse rows, severidad fuera de injuries CSV. */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, withSource, closeAll } = require('../src/db');
const config = require('../src/config');
const {
  syncInjurySiteCatalog,
  relinkLeadInjurySites,
  backfillPersonalSeverityFromInjuries,
  pruneEmptyLeadInjury,
} = require('../src/migration/injurySiteCatalog');

async function columnExists(conn, db, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [db, table, column]
  );
  return rows.length > 0;
}

async function dropInjuriesColumn(conn, db) {
  if (await columnExists(conn, db, 'lead_injury', 'injuries')) {
    await conn.query(`ALTER TABLE \`${db}\`.lead_injury DROP COLUMN injuries`);
    console.log('  ✓ drop lead_injury.injuries');
  } else {
    console.log('  · lead_injury ya sin injuries');
  }
}

async function main() {
  const db = config.target.database;
  console.log(`Lesiones estructuradas en ${db}…\n`);

  await withTarget(async (targetConn) => {
    const baseSql = fs.readFileSync(
      path.join(config.sqlDir, 'patches', 'injury_sites.sql'),
      'utf8'
    );
    await targetConn.query(baseSql);
    console.log('  ✓ ref_injury_site + lead_injury_site');

    await withSource(async (sourceConn) => {
      await syncInjurySiteCatalog(sourceConn, targetConn, { truncate: true });
    });

    const linked = await relinkLeadInjurySites(targetConn);
    console.log(`  ✓ lead_injury_site backfill: ${linked} filas`);

    const sevFixed = await backfillPersonalSeverityFromInjuries(targetConn);
    console.log(`  ✓ personal severity desde injuries: ${sevFixed} leads`);

    await dropInjuriesColumn(targetConn, db);

    const pruned = await pruneEmptyLeadInjury(targetConn);
    console.log(`  ✓ lead_injury sparse prune: ${pruned} filas vacías eliminadas`);

    const viewSql = fs.readFileSync(
      path.join(config.sqlDir, '03_view_tblLeads_flat.sql'),
      'utf8'
    );
    await targetConn.query(viewSql);
    console.log('  ✓ vista v_tblLeads_flat');
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
