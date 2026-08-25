const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function readDb(prefix, required) {
  const host = (process.env[`${prefix}_HOST`] || '').trim();
  const database = (process.env[`${prefix}_DATABASE`] || '').trim();
  const user = (process.env[`${prefix}_USER`] || '').trim();
  const password = process.env[`${prefix}_PASSWORD`] ?? '';

  if (!host || !database || !user) {
    if (required) {
      throw new Error(
        `Faltan variables ${prefix}_HOST, ${prefix}_DATABASE o ${prefix}_USER en .env`
      );
    }
    return null;
  }

  return {
    host,
    port: Number(process.env[`${prefix}_PORT`] || 3306),
    user,
    password,
    database,
  };
}

const target = readDb('MIG_TARGET', true);
const source = readDb('MIG_SOURCE', false);

/** SECURITY_TNFG — defaults al mismo host/user que MIG_TARGET si no hay MIG_SECURITY_* */
function readSecurityDb() {
  const explicit = readDb('MIG_SECURITY', false);
  if (explicit) return explicit;
  const dbName = (process.env.MIG_SECURITY_DATABASE || 'SECURITY_TNFG').trim();
  if (!dbName) return null;
  return {
    host: target.host,
    port: target.port,
    user: target.user,
    password: target.password,
    database: dbName,
  };
}

const security = readSecurityDb();

/** identity_service_dev — mismo host que SRC_ALT si no hay MIG_IDENTITY_* */
function readIdentityDb() {
  const explicit = readDb('MIG_IDENTITY', false);
  if (explicit) return explicit;
  const host = (process.env.SRC_ALT_DB_HOST || '').trim();
  const user = (process.env.SRC_ALT_DB_USER || '').trim();
  const password = process.env.SRC_ALT_DB_PASSWORD ?? '';
  const database = (process.env.MIG_IDENTITY_DATABASE || 'identity_service_dev').trim();
  if (!host || !user || !database) return null;
  return {
    host,
    port: Number(process.env.SRC_ALT_DB_PORT || 3306),
    user,
    password,
    database,
  };
}

const identity = readIdentityDb();

function sameConnection(a, b) {
  if (!b) return true;
  return (
    a.host === b.host &&
    a.port === b.port &&
    a.user === b.user &&
    a.database === b.database
  );
}

function sameServer(a, b) {
  if (!b) return true;
  return a.host === b.host && a.port === b.port;
}

const resolvedSource = source || target;

/** Copia local de prod (p. ej. tblLeads_src) para no chocar con la vista tblLeads. */
function readSourceLeads() {
  const table = (process.env.MIG_SOURCE_LEADS_TABLE || 'tblLeads').trim();
  const onTarget = process.env.MIG_SOURCE_LEADS_ON_TARGET === '1';
  const database = onTarget ? target.database : resolvedSource.database;
  return {
    table,
    database,
    onTarget,
    sql: `\`${database}\`.\`${table}\``,
  };
}

const sourceLeads = readSourceLeads();

module.exports = {
  target,
  source: resolvedSource,
  sourceLeads,
  security,
  identity,
  hasSeparateSource: source != null && !sameConnection(target, source),
  // Solo host:port reales. MIG_SOURCE_LEADS_ON_TARGET no implica mismo MySQL
  // (staging en TNFG_INTAKE; tblLeadComments sigue en otro servidor).
  sameServerAsTarget: source == null || sameServer(target, source),
  sqlDir: path.join(__dirname, '..', 'sql'),
};
