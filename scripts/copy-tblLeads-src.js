#!/usr/bin/env node
/**
 * Copia dbProduction.tblLeads → TNFG_INTAKE.tblLeads_src (BASE TABLE).
 * No toca la vista TNFG_INTAKE.tblLeads. No usa mysqldump.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const config = require('../src/config');
const { withSource, withTarget, closeAll } = require('../src/db');

const SRC_TABLE = 'tblLeads';
const DEST_TABLE = process.env.MIG_SOURCE_LEADS_TABLE || 'tblLeads_src';
const BATCH = Number(process.env.MIG_COPY_LEADS_BATCH || 200);

function quoteIdent(name) {
  return '`' + String(name).replace(/`/g, '``') + '`';
}

function rewriteCreateSql(createSql, fromTable, toTable) {
  const from = quoteIdent(fromTable);
  const to = quoteIdent(toTable);
  const rewritten = createSql.replace(`CREATE TABLE ${from}`, `CREATE TABLE ${to}`);
  if (rewritten === createSql) {
    throw new Error('No se pudo renombrar CREATE TABLE (¿cambió el DDL de prod?)');
  }
  return rewritten;
}

async function main() {
  if (DEST_TABLE.toLowerCase() === 'tbleads') {
    throw new Error(
      'No uses tblLeads como destino: en INTAKE es una VISTA. Usá tblLeads_src.'
    );
  }

  const srcDb = config.source.database;
  const tgtDb = config.target.database;

  console.log(`Copia ${config.source.host}/${srcDb}.${SRC_TABLE}`);
  console.log(`  → ${config.target.host}/${tgtDb}.${DEST_TABLE} (BASE TABLE)`);
  console.log(`  lote=${BATCH} (no pisa la vista tblLeads)\n`);

  await withTarget(async (targetConn) => {
    const [typeRows] = await targetConn.query(
      `SELECT TABLE_TYPE FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [tgtDb, DEST_TABLE]
    );
    if (typeRows[0] && String(typeRows[0].TABLE_TYPE).toUpperCase() === 'VIEW') {
      throw new Error(`${DEST_TABLE} ya es una VISTA. Usá otro nombre.`);
    }

    await withSource(async (sourceConn) => {
      const [createRows] = await sourceConn.query(
        `SHOW CREATE TABLE ${quoteIdent(srcDb)}.${quoteIdent(SRC_TABLE)}`
      );
      const createSql = createRows[0]['Create Table'];
      if (!createSql) throw new Error('SHOW CREATE TABLE vacío');

      await targetConn.query('SET FOREIGN_KEY_CHECKS = 0');
      await targetConn.query('SET UNIQUE_CHECKS = 0');
      await targetConn.query(
        `DROP TABLE IF EXISTS ${quoteIdent(tgtDb)}.${quoteIdent(DEST_TABLE)}`
      );
      await targetConn.query(rewriteCreateSql(createSql, SRC_TABLE, DEST_TABLE));

      const [[{ c: totalRows }]] = await sourceConn.query(
        `SELECT COUNT(*) AS c FROM ${quoteIdent(srcDb)}.${quoteIdent(SRC_TABLE)}`
      );
      console.log(`  origen: ${totalRows} filas`);

      const [colRows] = await sourceConn.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [srcDb, SRC_TABLE]
      );
      const cols = colRows.map((r) => r.COLUMN_NAME);
      const colList = cols.map(quoteIdent).join(', ');
      const rowPlaceholder = `(${cols.map(() => '?').join(', ')})`;

      let copied = 0;
      let lastId = 0;
      const started = Date.now();

      while (copied < totalRows) {
        const [rows] = await sourceConn.query(
          `SELECT * FROM ${quoteIdent(srcDb)}.${quoteIdent(SRC_TABLE)}
           WHERE idLead > ?
           ORDER BY idLead
           LIMIT ?`,
          [lastId, BATCH]
        );
        if (!rows.length) break;

        const valuesClause = rows.map(() => rowPlaceholder).join(', ');
        const params = rows.flatMap((row) => cols.map((c) => row[c]));
        await targetConn.query(
          `INSERT INTO ${quoteIdent(tgtDb)}.${quoteIdent(DEST_TABLE)} (${colList})
           VALUES ${valuesClause}`,
          params
        );

        copied += rows.length;
        lastId = rows[rows.length - 1].idLead;
        const elapsed = (Date.now() - started) / 1000;
        const rate = copied / Math.max(elapsed, 1);
        const eta = Math.round((totalRows - copied) / Math.max(rate, 1));
        process.stdout.write(
          `\r  … ${copied}/${totalRows}  ${rate.toFixed(0)} filas/s  eta ~${eta}s   `
        );
      }

      await targetConn.query('SET UNIQUE_CHECKS = 1');
      await targetConn.query('SET FOREIGN_KEY_CHECKS = 1');

      const [[{ c: destCount }]] = await targetConn.query(
        `SELECT COUNT(*) AS c FROM ${quoteIdent(tgtDb)}.${quoteIdent(DEST_TABLE)}`
      );
      const [[destMeta]] = await targetConn.query(
        `SELECT TABLE_TYPE t FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [tgtDb, DEST_TABLE]
      );
      const [[viewMeta]] = await targetConn.query(
        `SELECT TABLE_TYPE t FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tblLeads'`,
        [tgtDb]
      );

      const [[{ c: originNow }]] = await sourceConn.query(
        `SELECT COUNT(*) AS c FROM ${quoteIdent(srcDb)}.${quoteIdent(SRC_TABLE)}`
      );
      console.log(`\n\n✓ ${DEST_TABLE}: tipo=${destMeta?.t} filas=${destCount}`);
      console.log(`  vista tblLeads intacta: ${viewMeta?.t || 'no encontrada'}`);
      if (destCount !== originNow) {
        console.log(
          `  aviso: origen ahora=${originNow} (al inicio ${totalRows}). ` +
            `Prod sigue recibiendo leads; diferencia=${originNow - destCount}.`
        );
      }
    });
  });
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
  })
  .finally(() => closeAll());
