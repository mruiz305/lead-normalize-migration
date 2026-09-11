/**
 * Columnas g_users que faltaban en app_user (special access, prefs Glide, T&C, media).
 * No incluye estado de sesión del panel (cbLeadId, chat, booking…).
 */
const config = require('../config');

const APP_USER_EXTRA_FIELDS = [
  { src: 'hierarchySpecialAccessZc', dest: 'hierarchy_special_access_zc', ddl: "text DEFAULT NULL COMMENT 'g_users.hierarchySpecialAccessZc'" },
  { src: 'hierarchySpecialAccessCd', dest: 'hierarchy_special_access_cd', ddl: "text DEFAULT NULL COMMENT 'g_users.hierarchySpecialAccessCd'" },
  { src: 'systemKeyLeadLinker', dest: 'system_key_lead_linker', ddl: "varchar(50) DEFAULT NULL COMMENT 'g_users.systemKeyLeadLinker'" },
  { src: 'mediaIdMedia', dest: 'media_id_media', ddl: "varchar(100) DEFAULT NULL COMMENT 'g_users.mediaIdMedia'" },
  { src: 'shift', dest: 'shift', ddl: "varchar(50) DEFAULT NULL COMMENT 'g_users.shift'" },
  { src: 'Address', dest: 'address', ddl: "text DEFAULT NULL COMMENT 'g_users.Address'" },
  { src: 'profileShowRole', dest: 'profile_show_role', ddl: "tinyint(1) DEFAULT NULL COMMENT 'g_users.profileShowRole'", kind: 'flag' },
  { src: 'profileShowHr', dest: 'profile_show_hr', ddl: "tinyint(1) DEFAULT NULL COMMENT 'g_users.profileShowHr'", kind: 'flag' },
  { src: 'profileShowComp', dest: 'profile_show_comp', ddl: "tinyint(1) DEFAULT NULL COMMENT 'g_users.profileShowComp'", kind: 'flag' },
  { src: 'chartsHideVisuals1', dest: 'charts_hide_visuals_1', ddl: "tinyint(1) DEFAULT NULL COMMENT 'g_users.chartsHideVisuals1'", kind: 'flag' },
  { src: 'chartsHideVisuals2', dest: 'charts_hide_visuals_2', ddl: "tinyint(1) DEFAULT NULL COMMENT 'g_users.chartsHideVisuals2'", kind: 'flag' },
  { src: 'chartsHideVisuals3', dest: 'charts_hide_visuals_3', ddl: "tinyint(1) DEFAULT NULL COMMENT 'g_users.chartsHideVisuals3'", kind: 'flag' },
  { src: 'chartsHideVisuals4', dest: 'charts_hide_visuals_4', ddl: "tinyint(1) DEFAULT NULL COMMENT 'g_users.chartsHideVisuals4'", kind: 'flag' },
  { src: 'chartsShowVisuals1', dest: 'charts_show_visuals_1', ddl: "tinyint(1) DEFAULT NULL COMMENT 'g_users.chartsShowVisuals1'", kind: 'flag' },
  { src: 'chartsShowVisuals2', dest: 'charts_show_visuals_2', ddl: "tinyint(1) DEFAULT NULL COMMENT 'g_users.chartsShowVisuals2'", kind: 'flag' },
  { src: 'chartsShowVisuals3', dest: 'charts_show_visuals_3', ddl: "tinyint(1) DEFAULT NULL COMMENT 'g_users.chartsShowVisuals3'", kind: 'flag' },
  { src: 'chartsShowVisuals4', dest: 'charts_show_visuals_4', ddl: "tinyint(1) DEFAULT NULL COMMENT 'g_users.chartsShowVisuals4'", kind: 'flag' },
  { src: 'intakePanelIntakePanelStepper', dest: 'intake_panel_stepper', ddl: "int DEFAULT NULL COMMENT 'g_users.intakePanelIntakePanelStepper'", kind: 'int' },
  { src: 'intakePanelViewIntakeSection', dest: 'intake_panel_view_intake', ddl: "tinyint(1) DEFAULT NULL COMMENT 'g_users.intakePanelViewIntakeSection'", kind: 'flag' },
  { src: 'intakePanelViewDemoSection', dest: 'intake_panel_view_demo', ddl: "tinyint(1) DEFAULT NULL COMMENT 'g_users.intakePanelViewDemoSection'", kind: 'flag' },
  { src: 'intakePanelViewInsuranceSection', dest: 'intake_panel_view_insurance', ddl: "tinyint(1) DEFAULT NULL COMMENT 'g_users.intakePanelViewInsuranceSection'", kind: 'flag' },
  { src: 'intakePanelViewTxSection', dest: 'intake_panel_view_tx', ddl: "tinyint(1) DEFAULT NULL COMMENT 'g_users.intakePanelViewTxSection'", kind: 'flag' },
  { src: 'intakePanelViewAttySection', dest: 'intake_panel_view_atty', ddl: "tinyint(1) DEFAULT NULL COMMENT 'g_users.intakePanelViewAttySection'", kind: 'flag' },
  { src: 'intakePanelViewInjAndDamSection', dest: 'intake_panel_view_inj_and_dam', ddl: "tinyint(1) DEFAULT NULL COMMENT 'g_users.intakePanelViewInjAndDamSection'", kind: 'flag' },
  { src: 'intakePanelViewQuestionnaireSection', dest: 'intake_panel_view_questionnaire', ddl: "tinyint(1) DEFAULT NULL COMMENT 'g_users.intakePanelViewQuestionnaireSection'", kind: 'flag' },
  { src: 'intakePanelViewPsngrSection', dest: 'intake_panel_view_psngr', ddl: "tinyint(1) DEFAULT NULL COMMENT 'g_users.intakePanelViewPsngrSection'", kind: 'flag' },
  { src: 'agreedtoT&C', dest: 'agreed_to_tc', ddl: "tinyint(1) DEFAULT NULL COMMENT 'g_users.agreedtoT&C'", kind: 'flag' },
  { src: 'signedtoT&C', dest: 'signed_to_tc', ddl: "text DEFAULT NULL COMMENT 'g_users.signedtoT&C (URL firma)'" },
  { src: 'T&CTimestamp', dest: 'tc_agreed_at', ddl: "datetime DEFAULT NULL COMMENT 'g_users.T&CTimestamp'", kind: 'datetime' },
];

function quoteIdent(name) {
  return '`' + String(name).replace(/`/g, '``') + '`';
}

function toFlag(v) {
  if (v == null || v === '') return null;
  if (v === true || v === 1 || v === '1') return 1;
  if (v === false || v === 0 || v === '0') return 0;
  const s = String(v).trim().toLowerCase();
  if (s === 'true' || s === 'yes') return 1;
  if (s === 'false' || s === 'no') return 0;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n ? 1 : 0;
}

function toInt(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toText(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function coerceExtra(field, row) {
  const raw = row[field.src];
  if (field.kind === 'flag') return toFlag(raw);
  if (field.kind === 'int') return toInt(raw);
  if (field.kind === 'datetime') {
    if (raw == null || raw === '') return null;
    return raw;
  }
  return toText(raw);
}

function extraSelectSql(availableCols) {
  return APP_USER_EXTRA_FIELDS
    .filter((f) => !availableCols || availableCols.has(f.src))
    .map((f) => quoteIdent(f.src))
    .join(', ');
}

function extraInsertColumnsSql() {
  return APP_USER_EXTRA_FIELDS.map((f) => quoteIdent(f.dest)).join(', ');
}

function extraUpdateAssignmentsSql() {
  return APP_USER_EXTRA_FIELDS
    .map((f) => `${quoteIdent(f.dest)} = VALUES(${quoteIdent(f.dest)})`)
    .join(',\n  ');
}

function extraParamValues(row, availableCols) {
  return APP_USER_EXTRA_FIELDS.map((f) => {
    if (availableCols && !availableCols.has(f.src)) return null;
    return coerceExtra(f, row);
  });
}

async function loadGUserColumnSet(sourceConn) {
  const [rows] = await sourceConn.query(
    `SELECT COLUMN_NAME AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'g_users'`,
    [config.source.database]
  );
  return new Set(rows.map((r) => r.n));
}

async function columnExists(conn, db, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [db, table, column]
  );
  return rows.length > 0;
}

function expectedDataType(ddl) {
  const m = String(ddl).trim().match(/^(\w+)/);
  return m ? m[1].toLowerCase() : null;
}

async function columnDataType(conn, db, table, column) {
  const [rows] = await conn.query(
    `SELECT DATA_TYPE AS t FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [db, table, column]
  );
  return rows[0] ? String(rows[0].t).toLowerCase() : null;
}

async function ensureAppUserExtraColumns(targetConn) {
  const db = config.target.database;
  const added = [];
  const altered = [];
  for (const field of APP_USER_EXTRA_FIELDS) {
    if (!(await columnExists(targetConn, db, 'app_user', field.dest))) {
      await targetConn.query(
        `ALTER TABLE \`${db}\`.app_user ADD COLUMN ${quoteIdent(field.dest)} ${field.ddl}`
      );
      added.push(field.dest);
      continue;
    }
    const want = expectedDataType(field.ddl);
    const have = await columnDataType(targetConn, db, 'app_user', field.dest);
    if (want && have && want !== have) {
      await targetConn.query(
        `ALTER TABLE \`${db}\`.app_user MODIFY COLUMN ${quoteIdent(field.dest)} ${field.ddl}`
      );
      altered.push(field.dest);
    }
  }
  return { added, altered };
}

module.exports = {
  APP_USER_EXTRA_FIELDS,
  coerceExtra,
  toFlag,
  extraSelectSql,
  extraInsertColumnsSql,
  extraUpdateAssignmentsSql,
  extraParamValues,
  loadGUserColumnSet,
  ensureAppUserExtraColumns,
};
