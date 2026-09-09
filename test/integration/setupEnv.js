/** Apunta config/db a MySQL de integración. Debe correr ANTES de require(src). */
const port = process.env.INT_MYSQL_PORT || "3308";

process.env.MIG_TARGET_HOST = "127.0.0.1";
process.env.MIG_TARGET_PORT = port;
process.env.MIG_TARGET_USER = "root";
process.env.MIG_TARGET_PASSWORD = "test";
process.env.MIG_TARGET_DATABASE = "tnfg_intake_test";

process.env.MIG_SOURCE_HOST = "";
process.env.MIG_SOURCE_PORT = "";
process.env.MIG_SOURCE_USER = "";
process.env.MIG_SOURCE_PASSWORD = "";
process.env.MIG_SOURCE_DATABASE = "";

process.env.MIG_SOURCE_LEADS_ON_TARGET = "1";
process.env.MIG_SOURCE_LEADS_TABLE = "tblLeads_src";
process.env.MIG_SECURITY_DATABASE = "";
process.env.MIG_IDENTITY_DATABASE = "";

process.env.SRC_ALT_DB_HOST = "";
process.env.SRC_ALT_DB_USER = "";
process.env.SRC_ALT_DB_PASSWORD = "";
process.env.SRC_ALT_DB_DATABASE = "";
process.env.SRC_ALT_DB_NAME = "";

process.env.MIG_BATCH_SIZE = "20";
process.env.MIG_LIMIT = "0";
