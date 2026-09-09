const config = require('../config');

async function columnExists(conn, db, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [db, table, column]
  );
  return rows.length > 0;
}

async function indexExists(conn, db, table, name) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [db, table, name]
  );
  return rows.length > 0;
}

/**
 * Asegura unique por legacy_row_id (Glide rowId) y quita unique por email.
 * Idempotente: sync:users lo llama antes del upsert.
 */
async function ensureAppUserRowIdKey(targetConn) {
  const db = config.target.database;
  const changes = [];

  if (!(await columnExists(targetConn, db, 'app_user', 'nick'))) {
    await targetConn.query(`
      ALTER TABLE \`${db}\`.app_user
        ADD COLUMN nick varchar(100) DEFAULT NULL
          COMMENT 'g_users.nick — display alternativo'
          AFTER display_name
    `);
    changes.push('nick');
  }

  if (!(await columnExists(targetConn, db, 'app_user', 'referred_by'))) {
    await targetConn.query(`
      ALTER TABLE \`${db}\`.app_user
        ADD COLUMN referred_by varchar(150) DEFAULT NULL
          COMMENT 'g_users.Referred_By'
          AFTER individual_lead_sheet_url
    `);
    changes.push('referred_by');
  }

  if (!(await indexExists(targetConn, db, 'app_user', 'uk_app_user_legacy_row_id'))) {
    await targetConn.query(`
      ALTER TABLE \`${db}\`.app_user
        ADD UNIQUE KEY uk_app_user_legacy_row_id (legacy_row_id)
    `);
    changes.push('uk_app_user_legacy_row_id');
  }

  if (await indexExists(targetConn, db, 'app_user', 'uk_app_user_email')) {
    await targetConn.query(`ALTER TABLE \`${db}\`.app_user DROP INDEX uk_app_user_email`);
    changes.push('drop uk_app_user_email');
  }

  if (!(await indexExists(targetConn, db, 'app_user', 'idx_app_user_email'))) {
    await targetConn.query(`ALTER TABLE \`${db}\`.app_user ADD KEY idx_app_user_email (email)`);
    changes.push('idx_app_user_email');
  }

  return { changes };
}

module.exports = { ensureAppUserRowIdKey };
