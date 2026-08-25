#!/usr/bin/env node
/**
 * Sincroniza ref_state + ref_state_cnv desde dbProduction.refStates / refStates_cnv.
 * Preserva id_state = idState (1-50). Territorios TNFG-only (DC/PR/VI/GU) quedan is_active=0.
 *
 * npm run sync:ref-states
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { withTarget, withSource, closeAll } = require('../src/db');
const config = require('../src/config');

const PATCH_FILE = 'align_ref_state_with_prod.sql';
const TERRITORY_CODES = new Set(['DC', 'PR', 'VI', 'GU']);

function yesNoToBit(value) {
  return String(value ?? '').trim().toLowerCase() === 'yes' ? 1 : 0;
}

async function columnExists(conn, db, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 AS ok FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [db, table, column],
  );
  return Boolean(rows[0]);
}

async function tableExists(conn, db, table) {
  const [rows] = await conn.query(
    `SELECT 1 AS ok FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [db, table],
  );
  return Boolean(rows[0]);
}

async function applyAlignPatch(targetConn, db) {
  if (await columnExists(targetConn, db, 'ref_state', 'capitol')) {
    console.log('  skip DDL (capitol exists)');
    return;
  }
  const patchPath = path.join(config.sqlDir, 'patches', PATCH_FILE);
  const sql = fs.readFileSync(patchPath, 'utf8');
  await targetConn.query(sql);
  console.log('  ✓ DDL align_ref_state_with_prod');
}

async function syncStates(sourceConn, targetConn) {
  const src = config.source.database;
  const tgt = config.target.database;

  const [rows] = await sourceConn.query(`
    SELECT idState, State, Capitol, Abbreviation, acceptsAtFault, hasPIP
    FROM \`${src}\`.refStates
    ORDER BY idState
  `);

  let updated = 0;
  for (const r of rows) {
    const code = String(r.Abbreviation ?? '').trim().toUpperCase();
    const [res] = await targetConn.query(
      `UPDATE \`${tgt}\`.ref_state SET
         state_code = ?,
         state_name = ?,
         capitol = ?,
         accepts_at_fault = ?,
         has_pip = ?,
         country_code = 'US',
         is_active = 1
       WHERE id_state = ?`,
      [
        code,
        String(r.State ?? '').trim(),
        r.Capitol ?? null,
        yesNoToBit(r.acceptsAtFault),
        yesNoToBit(r.hasPIP),
        Number(r.idState),
      ],
    );
    updated += res.affectedRows ?? 0;

    if ((res.affectedRows ?? 0) === 0) {
      await targetConn.query(
        `INSERT INTO \`${tgt}\`.ref_state (
           id_state, state_code, state_name, capitol,
           accepts_at_fault, has_pip, country_code, is_active
         ) VALUES (?, ?, ?, ?, ?, ?, 'US', 1)`,
        [
          Number(r.idState),
          code,
          String(r.State ?? '').trim(),
          r.Capitol ?? null,
          yesNoToBit(r.acceptsAtFault),
          yesNoToBit(r.hasPIP),
        ],
      );
      updated += 1;
    }
  }

  const [territories] = await targetConn.query(
    `SELECT id_state, state_code FROM \`${tgt}\`.ref_state WHERE state_code IN ('DC','PR','VI','GU')`,
  );
  for (const t of territories) {
    await targetConn.query(
      `UPDATE \`${tgt}\`.ref_state SET is_active = 0 WHERE id_state = ?`,
      [t.id_state],
    );
  }

  return {
    prodRows: rows.length,
    updated,
    territoriesInactive: territories.length,
  };
}

async function syncCnv(sourceConn, targetConn) {
  const src = config.source.database;
  const tgt = config.target.database;

  if (!(await tableExists(targetConn, tgt, 'ref_state_cnv'))) {
    console.log('  skip ref_state_cnv (table missing — run patch:lead-business-rules)');
    return { synced: 0 };
  }

  const [rows] = await sourceConn.query(`
    SELECT sc.idState, sc.cnv, sc.active
    FROM \`${src}\`.refStates_cnv sc
    ORDER BY sc.idState
  `);

  let synced = 0;
  for (const r of rows) {
    const active =
      Buffer.isBuffer(r.active) ? r.active[0] === 1 : Boolean(r.active);
    await targetConn.query(
      `INSERT INTO \`${tgt}\`.ref_state_cnv (id_state, cnv_value, is_active)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         cnv_value = VALUES(cnv_value),
         is_active = VALUES(is_active)`,
      [Number(r.idState), Number(r.cnv), active ? 1 : 0],
    );
    synced += 1;
  }
  return { synced };
}

async function main() {
  const db = config.target.database;
  console.log(`Sync ref_state ← ${config.source.database} → ${db}\n`);

  await withTarget(async (targetConn) => {
    await applyAlignPatch(targetConn, db);

    await withSource(async (sourceConn) => {
      const stateStats = await syncStates(sourceConn, targetConn);
      console.log(
        `  ✓ ref_state: ${stateStats.prodRows} prod, ${stateStats.updated} upserted, ${stateStats.territoriesInactive} territorios → is_active=0`,
      );

      const cnvStats = await syncCnv(sourceConn, targetConn);
      console.log(`  ✓ ref_state_cnv: ${cnvStats.synced} filas`);

      const [[check]] = await targetConn.query(`
        SELECT
          SUM(is_active = 1) AS active_states,
          SUM(accepts_at_fault = 1) AS at_fault_yes,
          SUM(has_pip = 1) AS pip_yes,
          SUM(capitol IS NOT NULL) AS with_capitol
        FROM \`${db}\`.ref_state
      `);
      console.log('  ✓ resumen:', check);
    });
  });

  await closeAll();
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
