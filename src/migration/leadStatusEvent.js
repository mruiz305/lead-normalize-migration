const config = require('../config');

const DOMAIN = {
  LEAD: 'LEAD',
  LEGAL: 'LEGAL',
  CLINICAL: 'CLINICAL',
  STAGE: 'STAGE',
};

const TABLE = 'lead_status_event';
const FLUSH_BATCH = 500;

/** Catálogo nuevo (tblLeadsStatusCatalog) → ref* legacy */
const CATALOG_ALIASES = {
  legal: {
    signed: 'Signed',
    confirmed: 'Signed',
  },
  clinical: {
    active: 'Treating',
    dropped: 'Dropped',
    finalized: 'Finalized',
    inactive: 'Paused',
    'no show': 'No Show',
  },
};

function normKey(v) {
  if (v == null) return '';
  return String(v).trim().toLowerCase();
}

function buildCaseInsensitiveMap(nameMap) {
  const byLower = new Map();
  for (const [k, id] of nameMap) {
    byLower.set(normKey(k), id);
  }
  return byLower;
}

function buildStatusResolvers(maps) {
  const lead = buildCaseInsensitiveMap(maps.leadStatusByName);
  const legal = buildCaseInsensitiveMap(maps.legalStatusByName);
  const clinical = buildCaseInsensitiveMap(maps.clinicalStatusByName);
  const stage = buildCaseInsensitiveMap(maps.stageByCode);

  function resolve(domain, text) {
    const key = normKey(text);
    if (!key) return null;
    const table = {
      [DOMAIN.LEAD]: lead,
      [DOMAIN.LEGAL]: legal,
      [DOMAIN.CLINICAL]: clinical,
      [DOMAIN.STAGE]: stage,
    }[domain];
    return table?.get(key) ?? null;
  }

  function resolveCatalog(statusTypeId, catalogValue) {
    const type = normKey(statusTypeId);
    const key = normKey(catalogValue);
    const alias = CATALOG_ALIASES[type]?.[key];
    if (alias) {
      const domain = type === 'legal' ? DOMAIN.LEGAL : DOMAIN.CLINICAL;
      return { domain, id: resolve(domain, alias), text: alias };
    }
    if (type === 'legal' && key.includes('no case')) {
      return { domain: DOMAIN.LEGAL, id: resolve(DOMAIN.LEGAL, 'No Case'), text: 'No Case' };
    }
    const domain = type === 'legal' ? DOMAIN.LEGAL : DOMAIN.CLINICAL;
    const titled = String(catalogValue || '')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const id = resolve(domain, catalogValue) ?? resolve(domain, titled);
    return { domain, id, text: catalogValue?.trim() ?? '' };
  }

  return { resolve, resolveCatalog };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function logStep(msg) {
  console.log(`  · ${msg}`);
}

async function countTargetLeads(targetConn) {
  const db = config.target.database;
  const [[{ n }]] = await targetConn.query(`SELECT COUNT(*) AS n FROM \`${db}\`.lead`);
  return Number(n);
}

async function loadDurationEvents(sourceConn, targetConn, leadCount) {
  const src = config.source.database;
  const tgt = config.target.database;

  if (config.sameServerAsTarget) {
    logStep('dashLeadStatusDuration (join SQL)…');
    const [rows] = await targetConn.query(`
      SELECT d.IdLeadStatusDuration, d.idLead, d.valueBefore, d.valueAfter, d.statusBegin, d.statusEnd
      FROM \`${src}\`.dashLeadStatusDuration d
      INNER JOIN \`${tgt}\`.lead l ON l.id_lead = d.idLead
      ORDER BY d.idLead, d.statusBegin, d.IdLeadStatusDuration
    `);
    return rows;
  }

  logStep(`dashLeadStatusDuration (~${leadCount} leads, por lotes)…`);
  const [ids] = await targetConn.query(`SELECT id_lead FROM \`${tgt}\`.lead`);
  const out = [];
  const batches = chunk(ids.map((r) => r.id_lead), 5000);
  for (let i = 0; i < batches.length; i++) {
    const [rows] = await sourceConn.query(
      `SELECT IdLeadStatusDuration, idLead, valueBefore, valueAfter, statusBegin, statusEnd
       FROM \`${src}\`.dashLeadStatusDuration WHERE idLead IN (?)
       ORDER BY idLead, statusBegin, IdLeadStatusDuration`,
      [batches[i]]
    );
    out.push(...rows);
    if ((i + 1) % 10 === 0 || i === batches.length - 1) {
      logStep(`  duration ${i + 1}/${batches.length} lotes (${out.length} filas)`);
    }
  }
  return out;
}

async function loadCatalogStatusEvents(sourceConn, targetConn, leadCount) {
  const src = config.source.database;
  const tgt = config.target.database;

  if (config.sameServerAsTarget) {
    logStep('tblLeadsStatus (join SQL)…');
    const [rows] = await targetConn.query(`
      SELECT s.Id, s.idLead, s.createdBy, s.createdAt,
             c.value AS catalogValue, c.statusTypeId
      FROM \`${src}\`.tblLeadsStatus s
      INNER JOIN \`${src}\`.tblLeadsStatusCatalog c ON c.Id = s.leadsStatusCatalogId
      INNER JOIN \`${tgt}\`.lead l ON l.id_lead = s.idLead
      ORDER BY s.idLead, s.createdAt, s.Id
    `);
    return rows;
  }

  logStep(`tblLeadsStatus (~${leadCount} leads, por lotes)…`);
  const [ids] = await targetConn.query(`SELECT id_lead FROM \`${tgt}\`.lead`);
  const out = [];
  const batches = chunk(ids.map((r) => r.id_lead), 5000);
  for (let i = 0; i < batches.length; i++) {
    const [rows] = await sourceConn.query(
      `SELECT s.Id, s.idLead, s.createdBy, s.createdAt,
              c.value AS catalogValue, c.statusTypeId
       FROM \`${src}\`.tblLeadsStatus s
       INNER JOIN \`${src}\`.tblLeadsStatusCatalog c ON c.Id = s.leadsStatusCatalogId
       WHERE s.idLead IN (?)
       ORDER BY s.idLead, s.createdAt, s.Id`,
      [batches[i]]
    );
    out.push(...rows);
    if ((i + 1) % 10 === 0 || i === batches.length - 1) {
      logStep(`  catalog ${i + 1}/${batches.length} lotes (${out.length} filas)`);
    }
  }
  return out;
}

function buildDurationRows(rows, resolvers) {
  const pending = [];
  for (const r of rows) {
    const fromText = r.valueBefore?.trim() || null;
    const toText = r.valueAfter?.trim() || '';
    if (!toText) continue;
    const idTo = resolvers.resolve(DOMAIN.LEAD, toText);
    if (!idTo) continue;
    pending.push([
      Number(r.idLead),
      DOMAIN.LEAD,
      fromText ? resolvers.resolve(DOMAIN.LEAD, fromText) : null,
      idTo,
      r.statusEnd || r.statusBegin,
      null,
    ]);
  }
  return pending;
}

function buildCatalogRows(rows, resolvers, userByEmail) {
  const pending = [];
  const lastByLeadDomain = new Map();

  for (const r of rows) {
    const idLead = Number(r.idLead);
    const mapped = resolvers.resolveCatalog(r.statusTypeId, r.catalogValue);
    if (!mapped.text || !mapped.id) continue;

    const domainKey = `${idLead}:${mapped.domain}`;
    const prev = lastByLeadDomain.get(domainKey);
    if (prev && prev.id === mapped.id) continue;

    const changedBy = r.createdBy?.trim() || null;
    const userId = changedBy ? userByEmail.get(normKey(changedBy)) ?? null : null;

    pending.push([
      idLead,
      mapped.domain,
      prev?.id ?? null,
      mapped.id,
      r.createdAt,
      userId,
    ]);

    lastByLeadDomain.set(domainKey, { id: mapped.id });
  }
  return pending;
}

async function flushEvents(targetConn, batch, label) {
  if (!batch.length) return 0;
  const db = config.target.database;
  const head = `
    INSERT INTO \`${db}\`.${TABLE} (
      id_lead, status_domain, id_status_from, id_status_to,
      changed_at, changed_by_user_id
    ) VALUES
  `;
  const ph = '(?, ?, ?, ?, ?, ?)';
  let inserted = 0;
  const batches = Math.ceil(batch.length / FLUSH_BATCH);
  for (let i = 0; i < batch.length; i += FLUSH_BATCH) {
    const slice = batch.slice(i, i + FLUSH_BATCH);
    const [result] = await targetConn.query(
      `${head} ${slice.map(() => ph).join(', ')}`,
      slice.flat()
    );
    inserted += result.affectedRows;
    const bi = Math.floor(i / FLUSH_BATCH) + 1;
    if (label && (bi % 20 === 0 || bi === batches)) {
      logStep(`  ${label} insert ${bi}/${batches}`);
    }
  }
  return inserted;
}

async function backfillMissingDomainSnapshots(targetConn) {
  const db = config.target.database;
  logStep('snapshot estado vigente (INSERT SELECT)…');

  const inserts = [
    [`INSERT INTO \`${db}\`.${TABLE}
      (id_lead, status_domain, id_status_from, id_status_to, changed_at)
      SELECT l.id_lead, 'LEAD', NULL, l.id_lead_status, l.created_at
      FROM \`${db}\`.lead l
      WHERE l.id_lead_status IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM \`${db}\`.${TABLE} e
          WHERE e.id_lead = l.id_lead AND e.status_domain = 'LEAD'
        )`, 'LEAD'],
    [`INSERT INTO \`${db}\`.${TABLE}
      (id_lead, status_domain, id_status_from, id_status_to, changed_at)
      SELECT l.id_lead, 'LEGAL', NULL, ll.id_legal_status, l.created_at
      FROM \`${db}\`.lead l
      INNER JOIN \`${db}\`.lead_legal ll ON ll.id_lead = l.id_lead
      WHERE ll.id_legal_status IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM \`${db}\`.${TABLE} e
          WHERE e.id_lead = l.id_lead AND e.status_domain = 'LEGAL'
        )`, 'LEGAL'],
    [`INSERT INTO \`${db}\`.${TABLE}
      (id_lead, status_domain, id_status_from, id_status_to, changed_at)
      SELECT l.id_lead, 'CLINICAL', NULL, lc.id_clinical_status, l.created_at
      FROM \`${db}\`.lead l
      INNER JOIN \`${db}\`.lead_clinical lc ON lc.id_lead = l.id_lead
      WHERE lc.id_clinical_status IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM \`${db}\`.${TABLE} e
          WHERE e.id_lead = l.id_lead AND e.status_domain = 'CLINICAL'
        )`, 'CLINICAL'],
    [`INSERT INTO \`${db}\`.${TABLE}
      (id_lead, status_domain, id_status_from, id_status_to, changed_at)
      SELECT l.id_lead, 'STAGE', NULL, l.id_stage, l.created_at
      FROM \`${db}\`.lead l
      WHERE l.id_stage IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM \`${db}\`.${TABLE} e
          WHERE e.id_lead = l.id_lead AND e.status_domain = 'STAGE'
        )`, 'STAGE'],
  ];

  let total = 0;
  for (const [sql, label] of inserts) {
    const [result] = await targetConn.query(sql);
    total += result.affectedRows;
    logStep(`  snapshot ${label}: ${result.affectedRows}`);
  }
  return total;
}

async function syncLeadStatusEvents(sourceConn, targetConn, maps, { truncate = true } = {}) {
  const db = config.target.database;
  const resolvers = buildStatusResolvers(maps);
  const userByEmail = maps.userByEmail;
  const started = Date.now();

  const leadCount = await countTargetLeads(targetConn);
  if (!leadCount) {
    console.log('  ⚠ sin leads en destino — omite sync status');
    return { inserted: 0, duration: 0, catalog: 0, snapshot: 0 };
  }
  logStep(`${leadCount} leads en destino`);

  if (truncate) {
    await targetConn.query('SET FOREIGN_KEY_CHECKS = 0');
    await targetConn.query(`TRUNCATE TABLE \`${db}\`.${TABLE}`);
    await targetConn.query('SET FOREIGN_KEY_CHECKS = 1');
    logStep('tabla truncada');
  }

  const durationRows = await loadDurationEvents(sourceConn, targetConn, leadCount);
  const fromDuration = buildDurationRows(durationRows, resolvers);
  logStep(`duration → ${fromDuration.length} eventos`);
  const insDuration = await flushEvents(targetConn, fromDuration, 'duration');

  const catalogRows = await loadCatalogStatusEvents(sourceConn, targetConn, leadCount);
  const fromCatalog = buildCatalogRows(catalogRows, resolvers, userByEmail);
  logStep(`tblLeadsStatus → ${fromCatalog.length} eventos (dedupe)`);
  const insCatalog = await flushEvents(targetConn, fromCatalog, 'catalog');

  const insSnapshot = await backfillMissingDomainSnapshots(targetConn);

  const [[{ total }]] = await targetConn.query(
    `SELECT COUNT(*) AS total FROM \`${db}\`.${TABLE}`
  );
  const [[{ leadsWith }]] = await targetConn.query(`
    SELECT COUNT(DISTINCT id_lead) AS leadsWith FROM \`${db}\`.${TABLE}
  `);

  const secs = ((Date.now() - started) / 1000).toFixed(0);
  console.log(
    `  ✓ ${TABLE}: ${total} eventos` +
      ` (${insDuration} duration, ${insCatalog} tblLeadsStatus, ${insSnapshot} snapshot)` +
      ` — ${leadsWith}/${leadCount} leads — ${secs}s`
  );

  return {
    inserted: insDuration + insCatalog + insSnapshot,
    duration: insDuration,
    catalog: insCatalog,
    snapshot: insSnapshot,
    total,
    leadsWith,
  };
}

module.exports = {
  DOMAIN,
  TABLE,
  buildStatusResolvers,
  syncLeadStatusEvents,
};
