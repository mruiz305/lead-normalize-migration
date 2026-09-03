const mysql = require('mysql2/promise');
const config = require('./config');

function createPool(dbConfig, { jsonAsString = false } = {}) {
  const opts = {
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    waitForConnections: true,
    connectionLimit: 5,
    multipleStatements: true,
  };
  if (jsonAsString) {
    opts.typeCast = (field, next) => {
      if (field.type === 'JSON') return field.string('utf8');
      return next();
    };
  }
  return mysql.createPool(opts);
}

const targetPool = createPool(config.target);
const sourcePool = config.hasSeparateSource
  ? createPool(config.source, { jsonAsString: true })
  : targetPool;
const securityPool = config.security ? createPool(config.security) : null;
const identityPool = config.identity ? createPool(config.identity) : null;

async function withTarget(fn) {
  const conn = await targetPool.getConnection();
  try {
    return await fn(conn);
  } finally {
    conn.release();
  }
}

async function withSource(fn) {
  const conn = await sourcePool.getConnection();
  try {
    return await fn(conn);
  } finally {
    conn.release();
  }
}

async function withSecurity(fn) {
  if (!securityPool) {
    throw new Error('MIG_SECURITY_* o MIG_SECURITY_DATABASE no configurado en .env');
  }
  const conn = await securityPool.getConnection();
  try {
    return await fn(conn);
  } finally {
    conn.release();
  }
}

async function withIdentity(fn) {
  if (!identityPool) {
    throw new Error('SRC_ALT_DB_* o MIG_IDENTITY_* no configurado para identity_service_dev');
  }
  const conn = await identityPool.getConnection();
  try {
    return await fn(conn);
  } finally {
    conn.release();
  }
}

async function closeAll() {
  await targetPool.end();
  if (config.hasSeparateSource) {
    await sourcePool.end();
  }
  if (securityPool) {
    await securityPool.end();
  }
  if (identityPool) {
    await identityPool.end();
  }
}

module.exports = {
  targetPool,
  sourcePool,
  securityPool,
  identityPool,
  withTarget,
  withSource,
  withSecurity,
  withIdentity,
  closeAll,
};
