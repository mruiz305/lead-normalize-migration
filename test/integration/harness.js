#!/usr/bin/env node
const { spawnSync } = require("child_process");
const path = require("path");
const mysql = require("mysql2/promise");

const ROOT = path.join(__dirname, "../..");
const COMPOSE = path.join(__dirname, "docker-compose.yml");
const PROJECT = "tnfg-mig-int";
const PORT = process.env.INT_MYSQL_PORT || "3308";

function docker(args) {
  return spawnSync("docker", args, { stdio: "inherit" });
}

async function waitForMysql() {
  const deadline = Date.now() + 90_000;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const conn = await mysql.createConnection({
        host: "127.0.0.1",
        port: Number(PORT),
        user: "root",
        password: "test",
      });
      await conn.query("SELECT 1");
      await conn.end();
      return;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(`MySQL de integración no respondió en :${PORT} — ${lastErr?.message}`);
}

async function main() {
  if (process.env.SKIP_INT === "1") {
    console.log("test:int omitido (SKIP_INT=1)");
    return;
  }

  const info = spawnSync("docker", ["info"], { encoding: "utf8" });
  if (info.status !== 0) {
    console.error("Docker no está disponible. Semana 2 necesita Docker Desktop.");
    process.exit(process.env.CI ? 0 : 1);
  }

  const up = docker(["compose", "-f", COMPOSE, "-p", PROJECT, "up", "-d"]);
  if (up.status !== 0) process.exit(up.status ?? 1);

  await waitForMysql();

  const env = {
    ...process.env,
    INT_MYSQL_PORT: PORT,
    MIG_TARGET_HOST: "127.0.0.1",
    MIG_TARGET_PORT: PORT,
    MIG_TARGET_USER: "root",
    MIG_TARGET_PASSWORD: "test",
    MIG_TARGET_DATABASE: "tnfg_intake_test",
    MIG_SOURCE_HOST: "",
    MIG_SOURCE_DATABASE: "",
    MIG_SOURCE_USER: "",
    MIG_SOURCE_PASSWORD: "",
    MIG_SOURCE_LEADS_ON_TARGET: "1",
    MIG_SOURCE_LEADS_TABLE: "tblLeads_src",
    MIG_SECURITY_DATABASE: "",
    MIG_IDENTITY_DATABASE: "",
    SRC_ALT_DB_HOST: "",
    MIG_BATCH_SIZE: "20",
    MIG_LIMIT: "0",
  };

  const test = spawnSync(
    process.execPath,
    ["--test", path.join(__dirname, "migrate.test.js")],
    { stdio: "inherit", env, cwd: ROOT }
  );
  process.exit(test.status ?? 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
