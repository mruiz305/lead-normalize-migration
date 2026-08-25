#!/usr/bin/env node
/**
 * Parses Intake + Security SQL into schema-dictionary/public/schema-catalog.json
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_PUBLIC = path.join(ROOT, 'schema-dictionary', 'public', 'schema-catalog.json');
const OUT_DIST = path.join(ROOT, 'schema-dictionary', 'dist', 'schema-catalog.json');
const {
  API_MIGRATION_META,
  API_MIGRATION_PROGRESS,
  API_MIGRATION_BLOCKS,
  API_MIGRATION_DIFFS,
} = require(path.join(ROOT, 'docs', 'api-migration-map.js'));
const {
  INTAKE_SECURITY_META,
  INTAKE_SECURITY_SEEDS,
  INTAKE_ROLES,
  PORTAL_BRIDGE_ROLES,
  INTAKE_VISTAS,
  INTAKE_API_ACL,
  INTAKE_SECURITY_STATS,
} = require(path.join(ROOT, 'docs', 'intake-security-map.js'));
const {
  SECURITY_API_META,
  SECURITY_API_BLOCKS,
  SECURITY_API_STATS,
} = require(path.join(ROOT, 'docs', 'security-api-map.js'));

function loadMigrationFlow() {
  const flowPath = path.join(ROOT, 'docs', 'migration-flow-map.js');
  if (!fs.existsSync(flowPath)) {
    console.warn('WARN: migration-flow-map.js not found — skipping migrationFlow in catalog');
    return null;
  }
  const {
    MIGRATION_PIPELINE,
    MIGRATION_SOURCES,
    MIGRATION_CORRESPONDENCE_OVERVIEW,
    buildSourceCorrespondence,
    TBLLEADS_COLUMN_GROUPS,
    G_USERS_COLUMN_GROUPS,
  } = require(flowPath);
  return {
    title: 'Origen legacy → tablas TNFG_INTAKE',
    description:
      'Mapa de referencia: de qué tabla de producción sale cada entidad del modelo Intake normalizado.',
    pipeline: MIGRATION_PIPELINE,
    sources: MIGRATION_SOURCES,
    columnGroups: TBLLEADS_COLUMN_GROUPS,
    gUsersColumnGroups: G_USERS_COLUMN_GROUPS,
    correspondenceOverview: MIGRATION_CORRESPONDENCE_OVERVIEW,
    sourceCorrespondence: Object.fromEntries(
      MIGRATION_SOURCES.map((s) => [s.id, buildSourceCorrespondence(s)])
    ),
  };
}

const INTAKE_SQL = [
  path.join(ROOT, 'sql', '01_bootstrap.sql'),
  ...globSorted(path.join(ROOT, 'sql', 'patches', '*.sql')),
  path.join(ROOT, 'sql', '03_view_tblLeads_flat.sql'),
  path.join(ROOT, 'sql', '05_view_user_rehire_stats.sql'),
];

const SECURITY_SQL = globSorted(path.join(ROOT, 'sql', 'security', '*.sql'));

function globSorted(patternDir) {
  const dir = path.dirname(patternDir);
  const ext = path.basename(patternDir).replace('*', '');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(ext.replace(/^\*/, '')) || f.endsWith('.sql'))
    .sort()
    .map((f) => path.join(dir, f));
}

function readFiles(files) {
  return files
    .filter((f) => fs.existsSync(f))
    .map((f) => ({ file: path.relative(ROOT, f), sql: fs.readFileSync(f, 'utf8') }))
    .map(({ file, sql }) => ({ file, sql: unwrapPreparedStatements(sql) }));
}

/** Extract SQL from PREPARE/EXECUTE string literals */
function unwrapPreparedStatements(sql) {
  let out = sql;
  const re = /'((?:\\'|[^'])*)'/g;
  let m;
  while ((m = re.exec(sql)) !== null) {
    const inner = m[1].replace(/\\'/g, "'");
    if (/^\s*ALTER\s+TABLE/i.test(inner) || /^\s*CREATE\s+(TABLE|VIEW)/i.test(inner)) {
      out += '\n' + inner + '\n';
    }
  }
  return out;
}

function stripBlockComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '');
}

function stripLineComments(sql) {
  return sql
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join('\n');
}

function normalizeSql(sql) {
  return stripLineComments(stripBlockComments(sql));
}

function unquoteIdent(name) {
  return name.replace(/^[`"']|[`"']$/g, '');
}

function parseComment(str) {
  const m = str.match(/COMMENT\s+'((?:\\'|[^'])*)'/i);
  return m ? m[1].replace(/\\'/g, "'") : null;
}

function parseColumnLine(line) {
  const trimmed = line.trim().replace(/,\s*$/, '');
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (
    upper.startsWith('PRIMARY KEY') ||
    upper.startsWith('UNIQUE KEY') ||
    upper.startsWith('UNIQUE(') ||
    upper.startsWith('KEY ') ||
    upper.startsWith('INDEX ') ||
    upper.startsWith('CONSTRAINT ') ||
    upper.startsWith('FULLTEXT ') ||
    upper.startsWith('SPATIAL ')
  ) {
    return null;
  }

  const nameMatch = trimmed.match(/^(`[^`]+`|[a-zA-Z_][\w]*)/);
  if (!nameMatch) return null;

  const name = unquoteIdent(nameMatch[1]);
  let rest = trimmed.slice(nameMatch[0].length).trim();

  const comment = parseComment(rest);
  if (comment !== null) {
    rest = rest.replace(/COMMENT\s+'(?:\\'|[^'])*'/i, '').trim();
  }

  const notNull = /\bNOT\s+NULL\b/i.test(rest);
  const explicitNull = /\bNULL\b/i.test(rest) && !notNull;

  const typeMatch = rest.match(
    /^((?:enum|set)\([^)]+\)|[\w]+(?:\([^)]+\))?(?:\s+unsigned)?(?:\s+zerofill)?)/i
  );
  const type = typeMatch ? typeMatch[1].trim() : rest.split(/\s+/)[0] || 'unknown';

  return {
    name,
    type,
    nullable: explicitNull || (!notNull && !/\bPRIMARY\s+KEY\b/i.test(rest)),
    comment,
    foreignKey: null,
  };
}

function parseForeignKeys(body) {
  const fks = [];
  const re =
    /CONSTRAINT\s+\w+\s+FOREIGN\s+KEY\s+\(([^)]+)\)\s+REFERENCES\s+(`[^`]+`|[\w.]+)\s*\(([^)]+)\)/gi;
  let m;
  while ((m = re.exec(body)) !== null) {
    const columns = m[1].split(',').map((c) => unquoteIdent(c.trim()));
    const refTable = unquoteIdent(m[2].split('.').pop());
    const refColumns = m[3].split(',').map((c) => unquoteIdent(c.trim()));
    columns.forEach((col, i) => {
      fks.push({ column: col, referencesTable: refTable, referencesColumn: refColumns[i] || refColumns[0] });
    });
  }
  return fks;
}

function parseCreateTable(sql) {
  const tables = [];
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(`[^`]+`|[a-zA-Z_][\w]*)\s*\(/gi;
  let m;
  while ((m = re.exec(sql)) !== null) {
    const tableName = unquoteIdent(m[1]);
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < sql.length && depth > 0) {
      if (sql[i] === '(') depth++;
      else if (sql[i] === ')') depth--;
      i++;
    }
    const body = sql.slice(start, i - 1);
    const after = sql.slice(i, i + 500);
    const tableComment = parseComment(after);

    const columns = [];
    const colMap = new Map();
    const lines = splitColumnLines(body);
    for (const line of lines) {
      const col = parseColumnLine(line);
      if (col) {
        columns.push(col);
        colMap.set(col.name, col);
      }
    }

    for (const fk of parseForeignKeys(body)) {
      const col = colMap.get(fk.column);
      if (col) {
        col.foreignKey = { table: fk.referencesTable, column: fk.referencesColumn };
      }
    }

    tables.push({ name: tableName, kind: 'table', comment: tableComment, columns });
  }
  return tables;
}

function splitColumnLines(body) {
  const lines = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      lines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);
  return lines;
}

function parseCreateView(sql) {
  const views = [];
  const re = /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(`[^`]+`|[a-zA-Z_][\w]*)\s+AS\s+/gi;
  let m;
  while ((m = re.exec(sql)) !== null) {
    const name = unquoteIdent(m[1]);
    views.push({
      name,
      kind: 'view',
      comment: null,
      columns: [],
      viewSql: sql.slice(m.index, m.index + 200).includes('AS')
        ? extractViewPreview(sql, m.index + m[0].length)
        : null,
    });
  }
  return views;
}

function extractViewPreview(sql, start) {
  const snippet = sql.slice(start, start + 120).replace(/\s+/g, ' ').trim();
  return snippet.length > 100 ? snippet.slice(0, 100) + '…' : snippet;
}

function parseAlterTable(sql) {
  const alters = [];
  const re = /ALTER\s+TABLE\s+(`[^`]+`|[a-zA-Z_][\w]*)\s+([\s\S]*?)(?=;\s*(?:ALTER|CREATE|DROP|INSERT|SET|PREPARE|$))/gi;
  let m;
  while ((m = re.exec(sql)) !== null) {
    const tableName = unquoteIdent(m[1]);
    const body = m[2];
    alters.push({ table: tableName, body });
  }
  return alters;
}

function applyAlters(schema, alters) {
  for (const { table, body } of alters) {
    if (!schema[table]) {
      schema[table] = { name: table, kind: 'table', comment: null, columns: [] };
    }
    const colMap = new Map(schema[table].columns.map((c) => [c.name, c]));

    const addColRe =
      /ADD\s+(?:COLUMN\s+)?(`[^`]+`|[a-zA-Z_][\w]*)\s+([\s\S]*?)(?=,\s*(?:ADD|DROP|MODIFY|CHANGE|KEY|CONSTRAINT|INDEX)|$)/gi;
    let m;
    while ((m = addColRe.exec(body)) !== null) {
      const line = `${m[1]} ${m[2]}`.replace(/,\s*$/, '');
      const col = parseColumnLine(line);
      if (col && !colMap.has(col.name)) {
        schema[table].columns.push(col);
        colMap.set(col.name, col);
      } else if (col && colMap.has(col.name)) {
        Object.assign(colMap.get(col.name), col);
      }
    }

    const modColRe =
      /MODIFY\s+COLUMN\s+(`[^`]+`|[a-zA-Z_][\w]*)\s+([\s\S]*?)(?=,\s*(?:ADD|DROP|MODIFY|CHANGE|KEY|CONSTRAINT|INDEX)|$)/gi;
    while ((m = modColRe.exec(body)) !== null) {
      const line = `${m[1]} ${m[2]}`.replace(/,\s*$/, '');
      const col = parseColumnLine(line);
      if (col && colMap.has(col.name)) {
        Object.assign(colMap.get(col.name), col);
      }
    }

    const fkRe =
      /ADD\s+CONSTRAINT\s+\w+\s+FOREIGN\s+KEY\s+\(([^)]+)\)\s+REFERENCES\s+(`[^`]+`|[\w.]+)\s*\(([^)]+)\)/gi;
    while ((m = fkRe.exec(body)) !== null) {
      const colName = unquoteIdent(m[1].trim());
      const refTable = unquoteIdent(m[2].split('.').pop());
      const refCol = unquoteIdent(m[3].trim());
      const col = colMap.get(colName);
      if (col) col.foreignKey = { table: refTable, column: refCol };
    }
  }
}

function mergeSchema(entries) {
  const schema = {};
  for (const entry of entries) {
    schema[entry.name] = { ...entry, columns: [...entry.columns] };
  }
  return schema;
}

function intakeGroup(name, kind) {
  if (kind === 'view' || name.startsWith('v_')) return 'views';
  const t = name.toLowerCase();
  if (t.startsWith('client')) return 'clients';
  if (t === 'lead' || t.startsWith('lead_')) {
    if (['lead_status_event'].includes(t)) return 'audit';
    return 'lead';
  }
  if (['entity_log', 'log_detail', 'import_reject', 'lead_status_event'].includes(t)) return 'audit';
  if (
    [
      'app_user',
      'user_channel',
      'user_hr_period',
      'hierarchy_membership',
      'user_access_grant',
      'ref_company',
      'ref_company_office',
      'hierarchy_level',
      'lead_org_snapshot',
    ].includes(t)
  )
    return 'org';
  if (
    t.startsWith('ref_') ||
    /^ref[a-z]/i.test(name) ||
    ['party_kind', 'staff_kind'].includes(t)
  )
    return 'catalogs';
  return 'catalogs';
}

function securityGroup(name, kind) {
  if (kind === 'view') return 'rbac';
  const t = name.toLowerCase();
  if (['tenant', 'sistema'].includes(t)) return 'org';
  if (t === 'persona' || (t.startsWith('persona_') && !isAuthTable(t))) return 'identity';
  if (isAuthTable(t)) return 'auth';
  if (
    [
      'rol',
      'permiso',
      'rol_permiso',
      'persona_rol',
      'persona_acceso_recurso',
      'accion',
      'vista',
      'rol_vista_accion',
    ].includes(t)
  )
    return 'rbac';
  return 'rbac';
}

function isAuthTable(t) {
  return (
    t.startsWith('auth_') ||
    t === 'sistema_oauth_config' ||
    ['persona_credencial', 'persona_invitacion', 'persona_provision_log'].includes(t)
  );
}

const GROUP_LABELS = {
  intake: {
    org: 'Organization & Users',
    catalogs: 'Catalogs & Reference',
    clients: 'Clients',
    lead: 'Lead Domain',
    audit: 'Audit & Logging',
    views: 'Views',
  },
  security: {
    org: 'Organization',
    identity: 'Identity',
    rbac: 'RBAC & Permissions',
    auth: 'Authentication & OTP',
  },
};

function buildSystem(id, dbName, files, groupFn) {
  const sources = readFiles(files);
  let schema = {};

  for (const { sql } of sources) {
    const normalized = normalizeSql(sql);
    const tables = parseCreateTable(normalized);
    const views = parseCreateView(normalized);
    schema = mergeSchema([...Object.values(schema), ...tables, ...views]);
  }

  for (const { sql } of sources) {
    const normalized = normalizeSql(sql);
    applyAlters(schema, parseAlterTable(normalized));
  }

  const tables = Object.values(schema)
    .map((t) => {
      const group = groupFn(t.name, t.kind);
      const incomingFks = [];
      const outgoingFks = t.columns
        .filter((c) => c.foreignKey)
        .map((c) => ({
          column: c.name,
          referencesTable: c.foreignKey.table,
          referencesColumn: c.foreignKey.column,
        }));

      return {
        name: t.name,
        kind: t.kind,
        group,
        groupLabel: GROUP_LABELS[id][group],
        comment: t.comment,
        columnCount: t.columns.length,
        columns: t.columns.map(({ foreignKey, ...rest }) => rest),
        foreignKeys: outgoingFks,
        viewPreview: t.viewSql || null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const table of tables) {
    for (const fk of table.foreignKeys) {
      const target = tables.find((x) => x.name === fk.referencesTable);
      if (target) {
        if (!target.incomingForeignKeys) target.incomingForeignKeys = [];
        target.incomingForeignKeys.push({
          fromTable: table.name,
          column: fk.column,
          referencesColumn: fk.referencesColumn,
        });
      }
    }
  }

  return {
    id,
    name: id === 'intake' ? 'Intake' : 'Security',
    database: dbName,
    groups: Object.entries(GROUP_LABELS[id]).map(([key, label]) => ({
      id: key,
      label,
      tableCount: tables.filter((t) => t.group === key).length,
    })),
    tables,
    tableCount: tables.length,
    sources: sources.map((s) => s.file),
  };
}

function main() {
  const migrationFlow = loadMigrationFlow();
  const catalog = {
    generatedAt: new Date().toISOString(),
    bridge: {
      title: 'Intake ↔ Security Identity Bridge',
      description:
        'app_user.id_persona links each Intake staff record to a central persona in SECURITY_TNFG. This is a logical cross-database FK (same MySQL instance); the physical constraint is optional.',
      intake: {
        database: 'TNFG_INTAKE',
        table: 'app_user',
        column: 'id_persona',
        type: 'int unsigned',
      },
      security: {
        database: 'SECURITY_TNFG',
        table: 'persona',
        column: 'id_persona',
        type: 'int unsigned',
      },
      syncPath: [
        'INTAKE app_user (id_user, email, …)',
        '→ app_user.id_persona',
        '→ SECURITY persona (id_persona)',
        '↔ persona_sistema_origen (source_system=INTAKE_APP_USER, external_id=id_user)',
      ],
      notes: [
        'Column added via sql/patches/app_user_id_persona.sql',
        'Cross-DB FK is commented out; enforce at application layer or enable ALTER when both schemas exist',
        'RBAC roles attach to persona, not app_user directly',
        'Staff intake: persona_rol INTAKE + portal_intake_* bridge (see intakeSecurity panel)',
      ],
    },
    systems: [
      buildSystem('intake', 'TNFG_INTAKE', INTAKE_SQL, intakeGroup),
      buildSystem('security', 'SECURITY_TNFG', SECURITY_SQL, securityGroup),
    ],
    apiMigration: {
      meta: API_MIGRATION_META,
      progress: API_MIGRATION_PROGRESS,
      blocks: API_MIGRATION_BLOCKS,
      diffs: API_MIGRATION_DIFFS,
    },
    securityApi: {
      meta: SECURITY_API_META,
      blocks: SECURITY_API_BLOCKS,
      stats: SECURITY_API_STATS,
    },
    intakeSecurity: {
      meta: INTAKE_SECURITY_META,
      seeds: INTAKE_SECURITY_SEEDS,
      intakeRoles: INTAKE_ROLES,
      portalBridgeRoles: PORTAL_BRIDGE_ROLES,
      vistas: INTAKE_VISTAS,
      apiAcl: INTAKE_API_ACL,
      stats: INTAKE_SECURITY_STATS,
    },
  };

  if (migrationFlow) catalog.migrationFlow = migrationFlow;

  const json = JSON.stringify(catalog, null, 2);
  for (const out of [OUT_PUBLIC, OUT_DIST]) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, json);
    console.log(`Schema catalog written: ${out}`);
  }
  for (const sys of catalog.systems) {
    console.log(`  ${sys.name}: ${sys.tableCount} tables/views from ${sys.sources.length} files`);
  }
}

main();
