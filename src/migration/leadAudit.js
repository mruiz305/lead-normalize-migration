const config = require('../config');

const FULL_AUDIT_COLUMNS = [
  'created_at',
  'updated_at',
  'created_by_user_id',
  'updated_by_user_id',
];

const TIMELINE_AUDIT_COLUMNS = ['created_at', 'updated_at'];

/** Tablas 1:1 / N por lead con auditoría completa (hereda de lead al migrar). */
const LEAD_FULL_AUDIT_TABLES = [
  'lead_accident',
  'lead_legal',
  'lead_clinical',
  'lead_injury',
  'lead_org_snapshot',
  'lead_party',
  'lead_insurance',
  'lead_staff',
  'lead_sync_flag',
  'lead_injury_site',
  'lead_party_injury_site',
];

async function columnExists(conn, db, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [db, table, column]
  );
  return rows.length > 0;
}

async function fkExists(conn, db, table, fkName) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?
       AND CONSTRAINT_TYPE = 'FOREIGN KEY' LIMIT 1`,
    [db, table, fkName]
  );
  return rows.length > 0;
}

async function ensureFullAudit(conn, db, table) {
  if (await columnExists(conn, db, table, 'updated_at')) {
    return false;
  }

  await conn.query(`
    ALTER TABLE \`${db}\`.\`${table}\`
      ADD COLUMN created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      ADD COLUMN created_by_user_id int DEFAULT NULL,
      ADD COLUMN updated_by_user_id int DEFAULT NULL
  `);

  const idxCre = `idx_${table}_created_by`;
  const idxUpd = `idx_${table}_updated_by`;
  const fkCre = `fk_${table}_created_by`;
  const fkUpd = `fk_${table}_updated_by`;

  await conn.query(`
    ALTER TABLE \`${db}\`.\`${table}\`
      ADD KEY \`${idxCre}\` (created_by_user_id),
      ADD KEY \`${idxUpd}\` (updated_by_user_id)
  `);

  if (!(await fkExists(conn, db, table, fkCre))) {
    await conn.query(`
      ALTER TABLE \`${db}\`.\`${table}\`
        ADD CONSTRAINT \`${fkCre}\` FOREIGN KEY (created_by_user_id) REFERENCES \`${db}\`.app_user (id_user),
        ADD CONSTRAINT \`${fkUpd}\` FOREIGN KEY (updated_by_user_id) REFERENCES \`${db}\`.app_user (id_user)
    `);
  }

  return true;
}

async function ensureTimelineAudit(conn, db) {
  const table = 'lead_timeline';
  if (await columnExists(conn, db, table, 'updated_at')) {
    return false;
  }
  await conn.query(`
    ALTER TABLE \`${db}\`.\`${table}\`
      ADD COLUMN created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  `);
  return true;
}

async function backfillByLeadId(conn, db, table) {
  if (!(await columnExists(conn, db, table, 'created_by_user_id'))) {
    return 0;
  }
  const [result] = await conn.query(`
    UPDATE \`${db}\`.\`${table}\` t
    INNER JOIN \`${db}\`.\`lead\` l ON l.id_lead = t.id_lead
    SET
      t.created_at = COALESCE(l.created_at, t.created_at),
      t.updated_at = COALESCE(l.updated_at, l.created_at, t.updated_at),
      t.created_by_user_id = COALESCE(t.created_by_user_id, l.created_by_user_id),
      t.updated_by_user_id = COALESCE(t.updated_by_user_id, l.updated_by_user_id, l.created_by_user_id)
    WHERE t.created_by_user_id IS NULL
       OR t.updated_by_user_id IS NULL
       OR t.created_at IS NULL
  `);
  return result.affectedRows ?? 0;
}

async function backfillTimeline(conn, db) {
  const [result] = await conn.query(`
    UPDATE \`${db}\`.lead_timeline t
    INNER JOIN \`${db}\`.\`lead\` l ON l.id_lead = t.id_lead
    SET
      t.created_at = COALESCE(l.created_at, t.created_at),
      t.updated_at = COALESCE(l.updated_at, l.created_at, t.updated_at)
  `);
  return result.affectedRows ?? 0;
}

async function backfillInjurySite(conn, db) {
  const [result] = await conn.query(`
    UPDATE \`${db}\`.lead_injury_site lis
    INNER JOIN \`${db}\`.\`lead\` l ON l.id_lead = lis.id_lead
    SET
      lis.created_at = COALESCE(l.created_at, lis.created_at),
      lis.updated_at = COALESCE(l.updated_at, l.created_at, lis.updated_at),
      lis.created_by_user_id = COALESCE(lis.created_by_user_id, l.created_by_user_id),
      lis.updated_by_user_id = COALESCE(lis.updated_by_user_id, l.updated_by_user_id, l.created_by_user_id)
    WHERE lis.created_by_user_id IS NULL OR lis.updated_by_user_id IS NULL
  `);
  return result.affectedRows ?? 0;
}

async function backfillPartyInjurySite(conn, db) {
  const [result] = await conn.query(`
    UPDATE \`${db}\`.lead_party_injury_site lpis
    INNER JOIN \`${db}\`.lead_party lp ON lp.id_lead_party = lpis.id_lead_party
    INNER JOIN \`${db}\`.\`lead\` l ON l.id_lead = lp.id_lead
    SET
      lpis.created_at = COALESCE(l.created_at, lpis.created_at),
      lpis.updated_at = COALESCE(l.updated_at, l.created_at, lpis.updated_at),
      lpis.created_by_user_id = COALESCE(lpis.created_by_user_id, l.created_by_user_id),
      lpis.updated_by_user_id = COALESCE(lpis.updated_by_user_id, l.updated_by_user_id, l.created_by_user_id)
    WHERE lpis.created_by_user_id IS NULL OR lpis.updated_by_user_id IS NULL
  `);
  return result.affectedRows ?? 0;
}

async function applyLeadDomainAudit(conn) {
  const db = config.target.database;
  let added = 0;

  for (const table of LEAD_FULL_AUDIT_TABLES) {
    if (await ensureFullAudit(conn, db, table)) {
      console.log(`  ✓ ${table} + auditoría completa`);
      added += 1;
    } else {
      console.log(`  · ${table} ya tiene auditoría`);
    }
  }

  if (await ensureTimelineAudit(conn, db)) {
    console.log('  ✓ lead_timeline + created_at / updated_at (sin *_by_user — vive en lead)');
    added += 1;
  } else {
    console.log('  · lead_timeline ya tiene timestamps');
  }

  const backfillCounts = {};
  for (const table of LEAD_FULL_AUDIT_TABLES) {
    if (table === 'lead_injury_site') {
      backfillCounts[table] = await backfillInjurySite(conn, db);
    } else if (table === 'lead_party_injury_site') {
      backfillCounts[table] = await backfillPartyInjurySite(conn, db);
    } else {
      backfillCounts[table] = await backfillByLeadId(conn, db, table);
    }
  }
  backfillCounts.lead_timeline = await backfillTimeline(conn, db);

  for (const [table, n] of Object.entries(backfillCounts)) {
    if (n > 0) console.log(`  ✓ backfill ${table}: ${n} filas`);
  }

  return added;
}

function auditValues(audit) {
  return [audit.createdAt, audit.updatedAt, audit.createdByUserId, audit.updatedByUserId];
}

function auditTimestampValues(audit) {
  return [audit.createdAt, audit.updatedAt];
}

function withFullAudit(row, audit) {
  return [...row, ...auditValues(audit)];
}

function withTimelineAudit(row, audit) {
  return [...row, ...auditTimestampValues(audit)];
}

module.exports = {
  FULL_AUDIT_COLUMNS,
  TIMELINE_AUDIT_COLUMNS,
  LEAD_FULL_AUDIT_TABLES,
  applyLeadDomainAudit,
  auditValues,
  auditTimestampValues,
  withFullAudit,
  withTimelineAudit,
};
