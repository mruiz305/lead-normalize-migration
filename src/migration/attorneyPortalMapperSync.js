/**
 * Espejo de dbProduction.refAttorneys_portal_mapper → TNFG_INTAKE.ref_attorney_portal_mapper.
 *
 * Al migrar los casos al portal, varios abogados cambiaron de nombre ("Hess Will Assign" en el
 * lead, "Hess Will Assign (New Jersey)" en el caso). sp_UpdateLeadDataLegalAndClinicalStatus
 * usa este mapper para encontrar el caso con el nombre del portal; el datamart nuevo hace lo
 * mismo leyendo la copia stg_refAttorneys_portal_mapper. Mientras corren en paralelo, manda prod.
 *
 * Las columnas conservan los nombres de prod (attorney_prod, attorney_portal, createdAt) para que
 * la copia del ETL quede igual a la tabla original.
 */
const config = require('../config');

const DEFAULT_MAX_DELETES = 100;

function norm(v) {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
}

/**
 * @param {{id: number, attorney_prod: string, attorney_portal: string, createdAt: any}[]} prodRows
 * @param {{id: number, attorney_prod: string, attorney_portal: string}[]} currentRows
 */
function diffMapper(prodRows, currentRows) {
  const prod = new Map();
  for (const r of prodRows) {
    const id = Number(r.id);
    const from = norm(r.attorney_prod);
    const to = norm(r.attorney_portal);
    if (Number.isFinite(id) && from && to) prod.set(id, { id, from, to, createdAt: r.createdAt ?? null });
  }
  const current = new Map(currentRows.map((r) => [Number(r.id), r]));
  const upserts = [];
  for (const row of prod.values()) {
    const c = current.get(row.id);
    if (!c || c.attorney_prod !== row.from || c.attorney_portal !== row.to) upserts.push(row);
  }
  const deletes = [...current.keys()].filter((id) => !prod.has(id));
  return { upserts, deletes, prodCount: prod.size, currentCount: current.size };
}

async function ensureMapperTable(targetConn) {
  const tgt = config.target.database;
  await targetConn.query(`
    CREATE TABLE IF NOT EXISTS \`${tgt}\`.ref_attorney_portal_mapper (
      id INT NOT NULL COMMENT 'Mismo id que dbProduction.refAttorneys_portal_mapper',
      attorney_prod VARCHAR(255) NOT NULL COMMENT 'Nombre del abogado en el lead (Glide/prod)',
      attorney_portal VARCHAR(255) NOT NULL COMMENT 'Nombre del abogado en los casos del portal',
      createdAt DATETIME NULL,
      synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_attorney_prod (attorney_prod)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      COMMENT='Espejo de prod refAttorneys_portal_mapper: nombre de abogado prod → portal'
  `);
}

async function syncAttorneyPortalMapper(sourceConn, targetConn, { dryRun = false, maxDeletes = DEFAULT_MAX_DELETES } = {}) {
  const src = config.source.database;
  const tgt = config.target.database;

  const [prodRows] = await sourceConn.query(
    `SELECT id, attorney_prod, attorney_portal, createdAt FROM \`${src}\`.refAttorneys_portal_mapper`
  );
  if (!dryRun) await ensureMapperTable(targetConn);
  let currentRows = [];
  try {
    [currentRows] = await targetConn.query(
      `SELECT id, attorney_prod, attorney_portal FROM \`${tgt}\`.ref_attorney_portal_mapper`
    );
  } catch (err) {
    if (!(dryRun && (err.code === 'ER_NO_SUCH_TABLE' || err.errno === 1146))) throw err;
  }
  const diff = diffMapper(prodRows, currentRows);
  const deletesSkipped = diff.deletes.length > maxDeletes || diff.prodCount === 0;
  const stats = {
    prod: diff.prodCount,
    before: diff.currentCount,
    upserted: diff.upserts.length,
    deleted: deletesSkipped ? 0 : diff.deletes.length,
    deletesSkipped: deletesSkipped ? diff.deletes.length : 0,
  };
  if (dryRun) return stats;

  if (diff.upserts.length) {
    await targetConn.query(
      `INSERT INTO \`${tgt}\`.ref_attorney_portal_mapper (id, attorney_prod, attorney_portal, createdAt)
       VALUES ${diff.upserts.map(() => '(?, ?, ?, ?)').join(', ')}
       ON DUPLICATE KEY UPDATE attorney_prod = VALUES(attorney_prod),
         attorney_portal = VALUES(attorney_portal), createdAt = VALUES(createdAt)`,
      diff.upserts.flatMap((r) => [r.id, r.from, r.to, r.createdAt])
    );
  }
  if (!deletesSkipped && diff.deletes.length) {
    await targetConn.query(
      `DELETE FROM \`${tgt}\`.ref_attorney_portal_mapper WHERE id IN (${diff.deletes.map(() => '?').join(', ')})`,
      diff.deletes
    );
  }
  return stats;
}

module.exports = { syncAttorneyPortalMapper, diffMapper, ensureMapperTable, DEFAULT_MAX_DELETES };
