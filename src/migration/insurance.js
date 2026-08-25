const config = require('../config');

const SCOPE_PIP = 'PIP';
const SCOPE_AT_FAULT = 'AT_FAULT';

function norm(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function normalizeCarrierKey(name) {
  const s = norm(name);
  if (!s) return null;
  return s.toLowerCase().replace(/\s+/g, ' ');
}

function prodTypeToScope(type) {
  const t = String(type || '').trim().toLowerCase();
  if (t === 'insurance') return SCOPE_PIP;
  if (t === 'at fualt' || t === 'at fault') return SCOPE_AT_FAULT;
  return null;
}

function scopeForInsuranceRole(role) {
  return role === 'AT_FAULT' ? SCOPE_AT_FAULT : SCOPE_PIP;
}

function carrierMapKey(scope, normalizedName) {
  return `${scope}:${normalizedName}`;
}

async function syncInsuranceCatalog(sourceConn, targetConn, { truncate = true, afterId = 0 } = {}) {
  const srcDb = config.source.database;
  const tgtDb = config.target.database;
  const resumeFrom = Number(afterId) || 0;

  if (!truncate && resumeFrom === 0) {
    const [[{ total }]] = await targetConn.query(
      `SELECT COUNT(*) AS total FROM \`${tgtDb}\`.ref_insurance_carrier`
    );
    if (Number(total) > 0) {
      console.log(`  ✓ ref_insurance_carrier: ${total} total (skip sync)`);
      return { fromProd: 0, fromLeads: 0, total: Number(total) };
    }
  }

  if (truncate) {
    await targetConn.query('SET FOREIGN_KEY_CHECKS = 0');
    await targetConn.query(`TRUNCATE TABLE \`${tgtDb}\`.ref_insurance_carrier`);
    await targetConn.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  const [prodRows] = await sourceConn.query(`
    SELECT idInsurance, insurance, type
    FROM \`${srcDb}\`.refInsurance
    WHERE type IN ('Insurance', 'At Fualt')
    ORDER BY idInsurance
  `);

  let fromProd = 0;
  for (const r of prodRows) {
    const scope = prodTypeToScope(r.type);
    const name = norm(r.insurance);
    const nk = normalizeCarrierKey(name);
    if (!scope || !nk) continue;
    await targetConn.query(
      `INSERT INTO \`${tgtDb}\`.ref_insurance_carrier
         (id_carrier, carrier_name, normalized_name, catalog_scope)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         carrier_name = VALUES(carrier_name),
         catalog_scope = VALUES(catalog_scope)`,
      [r.idInsurance, name, nk, scope]
    );
    fromProd += 1;
  }

  const [[{ maxId }]] = await targetConn.query(
    `SELECT COALESCE(MAX(id_carrier), 0) AS maxId FROM \`${tgtDb}\`.ref_insurance_carrier`
  );
  if (Number(maxId) > 0) {
    await targetConn.query(
      `ALTER TABLE \`${tgtDb}\`.ref_insurance_carrier AUTO_INCREMENT = ?`,
      [Number(maxId) + 1]
    );
  }

  const leadFilter = !truncate && resumeFrom > 0 ? `AND idLead > ${resumeFrom}` : '';
  const leadsSql = config.sourceLeads.sql;
  const leadsConn = config.sourceLeads.onTarget ? targetConn : sourceConn;
  const [leadRows] = await leadsConn.query(`
    SELECT DISTINCT val, scope FROM (
      SELECT TRIM(pipInsurance) AS val, 'PIP' AS scope
        FROM ${leadsSql}
        WHERE pipInsurance IS NOT NULL AND TRIM(pipInsurance) <> '' ${leadFilter}
      UNION SELECT TRIM(atfaultInsurance), 'AT_FAULT'
        FROM ${leadsSql}
        WHERE atfaultInsurance IS NOT NULL AND TRIM(atfaultInsurance) <> '' ${leadFilter}
      UNION SELECT TRIM(psngr1Insurance), 'PIP'
        FROM ${leadsSql}
        WHERE psngr1Insurance IS NOT NULL AND TRIM(psngr1Insurance) <> '' ${leadFilter}
      UNION SELECT TRIM(psngr2Insurance), 'PIP'
        FROM ${leadsSql}
        WHERE psngr2Insurance IS NOT NULL AND TRIM(psngr2Insurance) <> '' ${leadFilter}
      UNION SELECT TRIM(psngr3Insurance), 'PIP'
        FROM ${leadsSql}
        WHERE psngr3Insurance IS NOT NULL AND TRIM(psngr3Insurance) <> '' ${leadFilter}
      UNION SELECT TRIM(psngr4Insurance), 'PIP'
        FROM ${leadsSql}
        WHERE psngr4Insurance IS NOT NULL AND TRIM(psngr4Insurance) <> '' ${leadFilter}
      UNION SELECT TRIM(psngr5Insurance), 'PIP'
        FROM ${leadsSql}
        WHERE psngr5Insurance IS NOT NULL AND TRIM(psngr5Insurance) <> '' ${leadFilter}
    ) u WHERE val IS NOT NULL
  `);

  let fromLeads = 0;
  for (const { val, scope } of leadRows) {
    const nk = normalizeCarrierKey(val);
    if (!nk) continue;
    const [res] = await targetConn.query(
      `INSERT IGNORE INTO \`${tgtDb}\`.ref_insurance_carrier
         (carrier_name, normalized_name, catalog_scope)
       VALUES (?, ?, ?)`,
      [val, nk, scope]
    );
    fromLeads += res.affectedRows;
  }

  const [[stats]] = await targetConn.query(`
    SELECT
      COUNT(*) AS total,
      SUM(catalog_scope = 'PIP') AS pip_cnt,
      SUM(catalog_scope = 'AT_FAULT') AS at_fault_cnt
    FROM \`${tgtDb}\`.ref_insurance_carrier
  `);

  const label = truncate
    ? `prod ${fromProd} + leads ${fromLeads} (${stats.total} total: ${stats.pip_cnt} PIP, ${stats.at_fault_cnt} AT_FAULT)`
    : `+${fromLeads} desde leads (${stats.total} total)`;
  console.log(`  ✓ ref_insurance_carrier: ${label}`);
  return {
    fromProd,
    fromLeads,
    total: Number(stats.total),
    pip: Number(stats.pip_cnt),
    atFault: Number(stats.at_fault_cnt),
  };
}

/** @deprecated alias — usar syncInsuranceCatalog */
async function seedInsuranceCarriers(sourceConn, targetConn, opts = {}) {
  const result = await syncInsuranceCatalog(sourceConn, targetConn, opts);
  return result.fromLeads + (opts.truncate !== false ? result.fromProd : 0);
}

async function ensureCarrier(targetConn, carrierByKey, name, scope) {
  const raw = norm(name);
  if (!raw || !scope) return null;
  const key = normalizeCarrierKey(raw);
  if (!key) return null;

  const mapKey = carrierMapKey(scope, key);
  let id = carrierByKey.get(mapKey) ?? null;
  if (id) return id;

  const db = config.target.database;
  await targetConn.query(
    `INSERT INTO \`${db}\`.ref_insurance_carrier (carrier_name, normalized_name, catalog_scope)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE carrier_name = VALUES(carrier_name)`,
    [raw, key, scope]
  );
  const [[row]] = await targetConn.query(
    `SELECT id_carrier FROM \`${db}\`.ref_insurance_carrier
     WHERE normalized_name = ? AND catalog_scope = ? LIMIT 1`,
    [key, scope]
  );
  id = row?.id_carrier ?? null;
  if (id) carrierByKey.set(mapKey, id);
  return id;
}

async function loadCarrierMap(targetConn) {
  const db = config.target.database;
  const [rows] = await targetConn.query(
    `SELECT id_carrier, normalized_name, carrier_name, catalog_scope
     FROM \`${db}\`.ref_insurance_carrier`
  );
  const carrierByKey = new Map();
  for (const r of rows) {
    if (r.normalized_name && r.catalog_scope) {
      carrierByKey.set(carrierMapKey(r.catalog_scope, r.normalized_name), r.id_carrier);
    }
  }

  function resolveCarrier(name, scope) {
    const raw = norm(name);
    if (!raw || !scope) return { raw: null, id: null };
    const key = normalizeCarrierKey(raw);
    const id = carrierByKey.get(carrierMapKey(scope, key)) ?? null;
    return { raw, id };
  }

  async function ensureCarrierForName(name, scope) {
    return ensureCarrier(targetConn, carrierByKey, name, scope);
  }

  return {
    carrierByKey,
    resolveCarrier,
    ensureCarrier: ensureCarrierForName,
    scopeForInsuranceRole,
    SCOPE_PIP,
    SCOPE_AT_FAULT,
  };
}

function sqlNormalizedExpr(columnSql) {
  return `LOWER(TRIM(REGEXP_REPLACE(${columnSql}, '[[:space:]]+', ' ')))`;
}

async function relinkLeadInsuranceCarriers(targetConn) {
  const db = config.target.database;
  const maps = await loadCarrierMap(targetConn);
  const normExpr = sqlNormalizedExpr('li.carrier_raw');

  const [missing] = await targetConn.query(`
    SELECT DISTINCT li.carrier_raw, li.insurance_role
    FROM \`${db}\`.lead_insurance li
    LEFT JOIN \`${db}\`.ref_insurance_carrier r
      ON r.normalized_name = ${normExpr}
     AND r.catalog_scope = IF(li.insurance_role = 'AT_FAULT', 'AT_FAULT', 'PIP')
    WHERE li.carrier_raw IS NOT NULL AND TRIM(li.carrier_raw) <> ''
      AND r.id_carrier IS NULL
  `);

  for (const row of missing) {
    const scope = scopeForInsuranceRole(row.insurance_role);
    await maps.ensureCarrier(row.carrier_raw, scope);
  }

  const [result] = await targetConn.query(`
    UPDATE \`${db}\`.lead_insurance li
    INNER JOIN \`${db}\`.ref_insurance_carrier r
      ON r.normalized_name = ${normExpr}
     AND r.catalog_scope = IF(li.insurance_role = 'AT_FAULT', 'AT_FAULT', 'PIP')
    SET li.id_carrier = r.id_carrier
    WHERE li.carrier_raw IS NOT NULL AND TRIM(li.carrier_raw) <> ''
  `);

  return result.affectedRows ?? result.changedRows ?? 0;
}

module.exports = {
  SCOPE_PIP,
  SCOPE_AT_FAULT,
  syncInsuranceCatalog,
  seedInsuranceCarriers,
  loadCarrierMap,
  normalizeCarrierKey,
  prodTypeToScope,
  scopeForInsuranceRole,
  ensureCarrier,
  relinkLeadInsuranceCarriers,
};
