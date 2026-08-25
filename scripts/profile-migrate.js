#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const config = require('../src/config');
const { sourcePool, targetPool, closeAll } = require('../src/db');
const { loadCatalogMaps } = require('../src/migration/maps');
const { syncInsuranceCatalog } = require('../src/migration/insurance');
const { flushLeadBatch, transformLead } = require('../src/migration/pipeline');

const SAMPLE = Number(process.argv[2] || 5);

(async () => {
  const src = await sourcePool.getConnection();
  const tgt = await targetPool.getConnection();

  const tPrep0 = Date.now();
  await syncInsuranceCatalog(src, tgt, { truncate: true });
  const prepMs = Date.now() - tPrep0;

  const t0 = Date.now();
  const [rows] = await src.query(
    `SELECT * FROM \`${config.source.database}\`.tblLeads ORDER BY idLead LIMIT ?`,
    [SAMPLE]
  );
  const fetchMs = Date.now() - t0;
  const rowKeys = Object.keys(rows[0] || {}).length;
  const rowBytes = JSON.stringify(rows[0] || {}).length;

  const maps = await loadCatalogMaps(tgt);

  let queryCount = 0;
  const origQuery = tgt.query.bind(tgt);
  tgt.query = async (...args) => {
    queryCount += 1;
    return origQuery(...args);
  };

  const mig0 = Date.now();
  await tgt.beginTransaction();
  const transformed = rows.map((row) => transformLead(row, maps));
  await flushLeadBatch(tgt, transformed, maps);
  await tgt.commit();
  const migMs = Date.now() - mig0;

  console.log('=== Perfil migración ===');
  console.log(`Leads muestra: ${SAMPLE}`);
  console.log(`syncInsuranceCatalog: ${prepMs}ms`);
  console.log(`SELECT * cols: ${rowKeys}, ~${Math.round(rowBytes / 1024)}KB por fila`);
  console.log(`Fetch origen: ${fetchMs}ms (${(fetchMs / SAMPLE).toFixed(0)}ms/lead)`);
  console.log(`Insert destino: ${migMs}ms (${(migMs / SAMPLE).toFixed(0)}ms/lead)`);
  console.log(`Queries destino: ${queryCount} total (${(queryCount / SAMPLE).toFixed(1)}/lead)`);
  console.log(`Proyección 200 leads: ~${Math.round((prepMs + (fetchMs / SAMPLE) * 200 + (migMs / SAMPLE) * 200) / 1000)}s total`);

  src.release();
  tgt.release();
  await closeAll();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
