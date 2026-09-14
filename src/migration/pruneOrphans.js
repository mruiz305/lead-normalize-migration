/**
 * Prod tblLeads es la fuente de verdad de IDs.
 * Quita de INTAKE (tblLeads_src + lead) lo que ya no existe en prod.
 * El sync incremental solo INSERT/UPSERT: sin esto quedan sentinels 2100 y drops.
 */
const config = require('../config');
const { deleteLeadGraphBySourceIds } = require('./pipeline');

const BATCH = 200;
const MIN_PROD_RATIO = 0.8;

function orphanIds(destIds, prodIds) {
  const out = [];
  for (const id of destIds) {
    if (!prodIds.has(id)) out.push(id);
  }
  return out;
}

function assertProdLooksHealthy(prodCount, destCount, { force = false } = {}) {
  if (!prodCount) {
    throw new Error('prod.tblLeads vacío — aborto (no se borra nada)');
  }
  if (destCount > 0 && prodCount < destCount * MIN_PROD_RATIO && !force) {
    throw new Error(
      `prod=${prodCount} es < 80% de INTAKE=${destCount} — aborto. Usa --force si es intencional.`
    );
  }
}

async function fetchIdSet(conn, sql) {
  const [rows] = await conn.query(sql);
  return new Set(rows.map((r) => Number(r.id)));
}

async function loadProdLeadIds(sourceConn) {
  return fetchIdSet(
    sourceConn,
    `SELECT idLead AS id FROM \`${config.source.database}\`.tblLeads`
  );
}

async function loadSrcLeadIds(targetConn) {
  const db = config.target.database;
  return fetchIdSet(targetConn, `SELECT idLead AS id FROM \`${db}\`.tblLeads_src`);
}

// Solo leads originados en Glide. Los del portal quedan fuera aunque tengan
// glide_id: ese glide_id apunta al espejo que leads-sync-api creó en prod, y
// si el espejo desaparece el lead del portal sigue siendo válido, no huérfano.
async function loadNormLeadIds(targetConn) {
  const db = config.target.database;
  return fetchIdSet(
    targetConn,
    `SELECT glide_id AS id FROM \`${db}\`.\`lead\`
     WHERE glide_id IS NOT NULL AND origin = 'GLIDE'`
  );
}

async function deleteSrcByIds(targetConn, ids) {
  const db = config.target.database;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const ph = chunk.map(() => '?').join(',');
    const [r] = await targetConn.query(
      `DELETE FROM \`${db}\`.tblLeads_src WHERE idLead IN (${ph})`,
      chunk
    );
    deleted += Number(r.affectedRows || 0);
  }
  return deleted;
}

async function deleteNormByIds(targetConn, ids) {
  let deleted = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    deleted += await deleteLeadGraphBySourceIds(targetConn, ids.slice(i, i + BATCH));
  }
  return deleted;
}

/**
 * @returns {{ prodCount: number, srcOrphans: number[], normOrphans: number[],
 *             deletedSrc: number, deletedNorm: number }}
 */
async function pruneLeadsNotInProd(sourceConn, targetConn, {
  dryRun = false,
  force = false,
  src = true,
  lead = true,
} = {}) {
  const prodIds = await loadProdLeadIds(sourceConn);
  const srcIds = src ? await loadSrcLeadIds(targetConn) : new Set();
  const normIds = lead ? await loadNormLeadIds(targetConn) : new Set();
  assertProdLooksHealthy(prodIds.size, Math.max(srcIds.size, normIds.size), { force });

  const srcOrphans = src ? orphanIds([...srcIds], prodIds) : [];
  const normOrphans = lead ? orphanIds([...normIds], prodIds) : [];
  let deletedSrc = 0;
  let deletedNorm = 0;

  if (!dryRun && srcOrphans.length) deletedSrc = await deleteSrcByIds(targetConn, srcOrphans);
  if (!dryRun && normOrphans.length) deletedNorm = await deleteNormByIds(targetConn, normOrphans);

  return {
    prodCount: prodIds.size,
    srcOrphans,
    normOrphans,
    deletedSrc,
    deletedNorm,
  };
}

module.exports = {
  orphanIds,
  assertProdLooksHealthy,
  loadProdLeadIds,
  pruneLeadsNotInProd,
  MIN_PROD_RATIO,
};
