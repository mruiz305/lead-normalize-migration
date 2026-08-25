#!/usr/bin/env node
/**
 * Actualiza TNFG_INTAKE.tblLeads_src desde prod (sin re-copiar todo):
 *  1) INSERT leads nuevos (idLead > MAX destino)
 *  2) UPSERT filas con updated >= --since (cambios de estado, etc.)
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

function parseSince(argv) {
  const idx = argv.indexOf('--since');
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

async function upsertBatch(sourceConn, targetConn, cols, rows, srcDb, tgtDb) {
  if (!rows.length) return 0;
  const colList = cols.map(quoteIdent).join(', ');
  const rowPh = `(${cols.map(() => '?').join(', ')})`;
  const valuesClause = rows.map(() => rowPh).join(', ');
  const updates = cols
    .filter((c) => c !== 'idLead')
    .map((c) => `${quoteIdent(c)}=VALUES(${quoteIdent(c)})`)
    .join(', ');
  const params = rows.flatMap((row) => cols.map((c) => row[c]));
  await targetConn.query(
    `INSERT INTO ${quoteIdent(tgtDb)}.${quoteIdent(DEST_TABLE)} (${colList})
     VALUES ${valuesClause}
     ON DUPLICATE KEY UPDATE ${updates}`,
    params
  );
  return rows.length;
}

async function syncNewLeads(sourceConn, targetConn, cols, srcDb, tgtDb, maxId) {
  let copied = 0;
  let lastId = maxId;
  const [[{ total }]] = await sourceConn.query(
    `SELECT COUNT(*) AS total FROM ${quoteIdent(srcDb)}.${quoteIdent(SRC_TABLE)} WHERE idLead > ?`,
    [maxId]
  );
  if (!total) return { copied: 0, newMax: maxId };

  console.log(`  nuevos (idLead > ${maxId}): ${total}`);
  while (true) {
    const [rows] = await sourceConn.query(
      `SELECT * FROM ${quoteIdent(srcDb)}.${quoteIdent(SRC_TABLE)}
       WHERE idLead > ? ORDER BY idLead LIMIT ?`,
      [lastId, BATCH]
    );
    if (!rows.length) break;
    copied += await upsertBatch(sourceConn, targetConn, cols, rows, srcDb, tgtDb);
    lastId = rows[rows.length - 1].idLead;
    process.stdout.write(`\r    … ${copied}/${total} nuevos`);
  }
  console.log('');
  return { copied, newMax: lastId };
}

async function syncUpdated(sourceConn, targetConn, cols, srcDb, tgtDb, since, maxId) {
  const [[{ total }]] = await sourceConn.query(
    `SELECT COUNT(*) AS total FROM ${quoteIdent(srcDb)}.${quoteIdent(SRC_TABLE)}
     WHERE updated >= ? AND idLead <= ?`,
    [since, maxId]
  );
  if (!total) return 0;

  console.log(`  actualizados (updated >= ${since}, idLead <= ${maxId}): ${total}`);
  let synced = 0;
  let lastId = 0;
  while (true) {
    const [rows] = await sourceConn.query(
      `SELECT * FROM ${quoteIdent(srcDb)}.${quoteIdent(SRC_TABLE)}
       WHERE updated >= ? AND idLead <= ? AND idLead > ?
       ORDER BY idLead LIMIT ?`,
      [since, maxId, lastId, BATCH]
    );
    if (!rows.length) break;
    synced += await upsertBatch(sourceConn, targetConn, cols, rows, srcDb, tgtDb);
    lastId = rows[rows.length - 1].idLead;
    process.stdout.write(`\r    … ${synced}/${total} actualizados`);
  }
  console.log('');
  return synced;
}

async function main() {
  const since = parseSince(process.argv);
  const dryRun = process.argv.includes('--dry-run');
  const srcDb = config.source.database;
  const tgtDb = config.target.database;

  console.log(`Sync ${config.source.host}/${srcDb}.${SRC_TABLE}`);
  console.log(`  → ${config.target.host}/${tgtDb}.${DEST_TABLE}`);
  console.log(`  since=${since}${dryRun ? ' (dry-run)' : ''}\n`);

  await withTarget(async (targetConn) => {
    const [typeRows] = await targetConn.query(
      `SELECT TABLE_TYPE FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [tgtDb, DEST_TABLE]
    );
    if (!typeRows.length || String(typeRows[0].TABLE_TYPE).toUpperCase() !== 'BASE TABLE') {
      throw new Error(`${DEST_TABLE} no existe o no es tabla. Ejecuta: npm run copy:tblLeads-src`);
    }

    await withSource(async (sourceConn) => {
      const [[{ copyMax }]] = await targetConn.query(
        `SELECT COALESCE(MAX(idLead), 0) AS copyMax FROM ${quoteIdent(tgtDb)}.${quoteIdent(DEST_TABLE)}`
      );
      const [[{ prodCount, prodMax }]] = await sourceConn.query(
        `SELECT COUNT(*) AS prodCount, MAX(idLead) AS prodMax
         FROM ${quoteIdent(srcDb)}.${quoteIdent(SRC_TABLE)}`
      );
      const [[{ newCount }]] = await sourceConn.query(
        `SELECT COUNT(*) AS newCount FROM ${quoteIdent(srcDb)}.${quoteIdent(SRC_TABLE)} WHERE idLead > ?`,
        [copyMax]
      );
      const [[{ updCount }]] = await sourceConn.query(
        `SELECT COUNT(*) AS updCount FROM ${quoteIdent(srcDb)}.${quoteIdent(SRC_TABLE)}
         WHERE updated >= ? AND idLead <= ?`,
        [since, copyMax]
      );

      console.log(`  copia actual: max idLead=${copyMax}`);
      console.log(`  prod ahora:   ${prodCount} filas, max idLead=${prodMax}`);
      console.log(`  delta:        +${newCount} nuevos, ~${updCount} con updated >= ${since}\n`);

      if (dryRun) return;

      const [colRows] = await sourceConn.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [srcDb, SRC_TABLE]
      );
      const cols = colRows.map((r) => r.COLUMN_NAME);

      console.log('Paso 1: leads nuevos…');
      const { copied: newCopied, newMax } = await syncNewLeads(
        sourceConn,
        targetConn,
        cols,
        srcDb,
        tgtDb,
        copyMax
      );

      console.log('Paso 2: filas modificadas…');
      const updCopied = await syncUpdated(
        sourceConn,
        targetConn,
        cols,
        srcDb,
        tgtDb,
        since,
        Math.max(copyMax, newMax)
      );

      const [[{ destCount, destMax }]] = await targetConn.query(
        `SELECT COUNT(*) AS destCount, MAX(idLead) AS destMax
         FROM ${quoteIdent(tgtDb)}.${quoteIdent(DEST_TABLE)}`
      );
      console.log(
        `\n✓ sync listo: +${newCopied} nuevos, ${updCopied} upsert por updated · destino=${destCount} (max ${destMax})`
      );
      if (Number(destCount) !== Number(prodCount)) {
        console.log(
          `  aviso: prod=${prodCount} vs copia=${destCount}. Si falta gap, ampliá --since o npm run copy:tblLeads-src`
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
