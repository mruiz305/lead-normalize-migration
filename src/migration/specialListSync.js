/**
 * Espejo de dbProduction.SpecialList → TNFG_INTAKE.ref_special_list.
 *
 * La lista se cargó una sola vez (seed:special-list, julio 2026) y producción la siguió
 * cambiando: leads que salen de la lista o cambian de ACTIVE a DROPPED. El datamart lee
 * la vista SpecialList (sobre ref_special_list), así que una fila vieja cambia el estado
 * del log y el CNV. Mientras los dos sistemas corren en paralelo, manda producción.
 *
 * Las filas que ya no están en prod se borran (no is_active = 0): la vista SpecialList
 * no filtra is_active y no se toca el modelo.
 */
const config = require('../config');

const DEFAULT_MAX_DELETES = 300;

function normStatus(s) {
  return String(s ?? '').trim().toUpperCase() === 'DROPPED' ? 'DROPPED' : 'ACTIVE';
}

function normKey(id) {
  const k = String(id ?? '').trim();
  return k === '' ? null : k;
}

/**
 * Compara prod contra la tabla actual.
 * @param {{ID: string, STATUS: string}[]} prodRows
 * @param {{lead_key: string, status_code: string}[]} currentRows
 */
function diffSpecialList(prodRows, currentRows) {
  const prod = new Map();
  for (const r of prodRows) {
    const k = normKey(r.ID);
    if (k) prod.set(k, normStatus(r.STATUS));
  }
  const current = new Map();
  for (const r of currentRows) {
    const k = normKey(r.lead_key);
    if (k) current.set(k, String(r.status_code ?? '').toUpperCase());
  }
  const upserts = [];
  for (const [k, status] of prod) {
    if (current.get(k) !== status) upserts.push({ key: k, status, isNew: !current.has(k) });
  }
  const deletes = [...current.keys()].filter((k) => !prod.has(k));
  return { upserts, deletes, prodCount: prod.size, currentCount: current.size };
}

async function syncSpecialList(sourceConn, targetConn, { dryRun = false, maxDeletes = DEFAULT_MAX_DELETES } = {}) {
  const src = config.source.database;
  const tgt = config.target.database;

  const [prodRows] = await sourceConn.query(
    `SELECT TRIM(ID) AS ID, STATUS FROM \`${src}\`.SpecialList WHERE TRIM(ID) <> ''`
  );
  const [currentRows] = await targetConn.query(
    `SELECT lead_key, status_code FROM \`${tgt}\`.ref_special_list`
  );
  const diff = diffSpecialList(prodRows, currentRows);

  // Prod vacía o caída a medias: no vaciar la lista nueva.
  const deletesSkipped = diff.deletes.length > maxDeletes || diff.prodCount === 0;
  const stats = {
    prod: diff.prodCount,
    before: diff.currentCount,
    inserted: diff.upserts.filter((u) => u.isNew).length,
    updated: diff.upserts.filter((u) => !u.isNew).length,
    deleted: deletesSkipped ? 0 : diff.deletes.length,
    deletesSkipped: deletesSkipped ? diff.deletes.length : 0,
  };
  if (dryRun) return stats;

  const BATCH = 200;
  for (let i = 0; i < diff.upserts.length; i += BATCH) {
    const chunk = diff.upserts.slice(i, i + BATCH);
    await targetConn.query(
      `INSERT INTO \`${tgt}\`.ref_special_list (lead_key, status_code, legacy_id, is_active)
       VALUES ${chunk.map(() => '(?, ?, ?, 1)').join(', ')}
       ON DUPLICATE KEY UPDATE status_code = VALUES(status_code), legacy_id = VALUES(legacy_id),
         is_active = 1, updated_at = CURRENT_TIMESTAMP`,
      chunk.flatMap((u) => [u.key, u.status, u.key])
    );
  }
  if (!deletesSkipped) {
    for (let i = 0; i < diff.deletes.length; i += BATCH) {
      const chunk = diff.deletes.slice(i, i + BATCH);
      await targetConn.query(
        `DELETE FROM \`${tgt}\`.ref_special_list WHERE lead_key IN (${chunk.map(() => '?').join(', ')})`,
        chunk
      );
    }
  }
  return stats;
}

module.exports = { syncSpecialList, diffSpecialList, normStatus, DEFAULT_MAX_DELETES };
