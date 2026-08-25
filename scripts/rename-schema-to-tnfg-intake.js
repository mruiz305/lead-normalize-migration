#!/usr/bin/env node
/**
 * Copia TNFG_MRUIZ → TNFG_INTAKE usando solo mysql2 (sin mysqldump CLI).
 * Pensado para cuando TNFG_INTAKE quedó creado vacío tras el error 1450.
 *
 * Uso:
 *   npm run rename:schema-intake
 *   npm run rename:schema-intake -- --drop-old
 */
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const HOST = process.env.MIG_TARGET_HOST;
const PORT = Number(process.env.MIG_TARGET_PORT || 3306);
const USER = process.env.MIG_TARGET_USER;
const PASSWORD = process.env.MIG_TARGET_PASSWORD || '';
const OLD_SCHEMA = process.env.OLD_SCHEMA || 'TNFG_MRUIZ';
const NEW_SCHEMA = process.env.NEW_SCHEMA || 'TNFG_INTAKE';
const DROP_OLD = process.argv.includes('--drop-old');

if (!HOST || !USER) {
  console.error('Faltan MIG_TARGET_HOST / MIG_TARGET_USER en .env');
  process.exit(1);
}

async function count(conn, schema, type) {
  const typeClause =
    type === 'table'
      ? "AND table_type = 'BASE TABLE'"
      : type === 'view'
        ? "AND table_type = 'VIEW'"
        : '';
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.tables
     WHERE table_schema = ? ${typeClause}`,
    [schema],
  );
  return Number(rows[0].cnt);
}

async function schemaExists(conn, schema) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
    [schema],
  );
  return Number(rows[0].cnt) > 0;
}

async function main() {
  const conn = await mysql.createConnection({
    host: HOST,
    port: PORT,
    user: USER,
    password: PASSWORD,
    multipleStatements: true,
  });

  try {
    console.log('==> Diagnóstico');
    console.log(`    Host: ${HOST}:${PORT}`);
    console.log(`    Origen:  ${OLD_SCHEMA}`);
    console.log(`    Destino: ${NEW_SCHEMA}`);

    const oldExists = await schemaExists(conn, OLD_SCHEMA);
    const newExists = await schemaExists(conn, NEW_SCHEMA);
    const oldTables = oldExists ? await count(conn, OLD_SCHEMA, 'table') : 0;
    const oldViews = oldExists ? await count(conn, OLD_SCHEMA, 'view') : 0;
    const newObjects = newExists ? await count(conn, NEW_SCHEMA, 'all') : 0;

    console.log(
      `    ${OLD_SCHEMA} tablas=${oldTables}, vistas=${oldViews}`,
    );
    console.log(`    ${NEW_SCHEMA} objetos=${newObjects}`);

    if (!oldExists) throw new Error(`No existe ${OLD_SCHEMA}`);
    if (oldTables + oldViews === 0) {
      throw new Error(`${OLD_SCHEMA} sin tablas/vistas`);
    }
    if (newObjects > 0) {
      const newTables = await count(conn, NEW_SCHEMA, 'table');
      if (newTables < oldTables) {
        throw new Error(
          `${NEW_SCHEMA} está incompleto (${newTables}/${oldTables} tablas). Borra el schema y reintenta.`,
        );
      }
      console.log(`    ${NEW_SCHEMA} ya tiene tablas; solo se completarán vistas faltantes.`);
    }

    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${NEW_SCHEMA}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );

    const [tableRows] = await conn.query(
      `SELECT table_name AS name
       FROM information_schema.tables
       WHERE table_schema = ? AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      [OLD_SCHEMA],
    );

    const existingTables = newObjects
      ? await count(conn, NEW_SCHEMA, 'table')
      : 0;

    if (existingTables === 0) {
      console.log(`==> Copiar ${tableRows.length} tablas`);
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');

      for (const row of tableRows) {
        const table = row.name;
        await conn.query(
          `CREATE TABLE \`${NEW_SCHEMA}\`.\`${table}\`
           LIKE \`${OLD_SCHEMA}\`.\`${table}\``,
        );
        const [result] = await conn.query(
          `INSERT INTO \`${NEW_SCHEMA}\`.\`${table}\`
           SELECT * FROM \`${OLD_SCHEMA}\`.\`${table}\``,
        );
        console.log(`    ${table}: ${result.affectedRows ?? 0} filas`);
      }
    } else {
      console.log(`==> Tablas ya copiadas (${existingTables}); omitiendo datos`);
    }

    const [viewRows] = await conn.query(
      `SELECT table_name AS name
       FROM information_schema.tables
       WHERE table_schema = ? AND table_type = 'VIEW'
       ORDER BY table_name`,
      [OLD_SCHEMA],
    );

    if (viewRows.length) {
      console.log(`==> Copiar ${viewRows.length} vistas`);
      for (const row of viewRows) {
        const view = row.name;
        const [defRows] = await conn.query(
          `SELECT VIEW_DEFINITION AS definition
           FROM information_schema.views
           WHERE table_schema = ? AND table_name = ?`,
          [OLD_SCHEMA, view],
        );
        const definition = defRows[0]?.definition;
        if (!definition) {
          throw new Error(`No se pudo leer definición de vista ${view}`);
        }
        await conn.query(
          `CREATE OR REPLACE VIEW \`${NEW_SCHEMA}\`.\`${view}\` AS ${definition}`,
        );
        console.log(`    ${view}`);
      }
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    const copiedTables = await count(conn, NEW_SCHEMA, 'table');
    const copiedViews = await count(conn, NEW_SCHEMA, 'view');
    console.log(
      `==> Verificación: ${NEW_SCHEMA} tablas=${copiedTables}, vistas=${copiedViews}`,
    );

    if (copiedTables !== oldTables || copiedViews !== oldViews) {
      throw new Error(
        `Conteo distinto (origen ${oldTables}/${oldViews}, destino ${copiedTables}/${copiedViews})`,
      );
    }

    if (DROP_OLD) {
      await conn.query(`DROP DATABASE \`${OLD_SCHEMA}\``);
      console.log(`==> Eliminado ${OLD_SCHEMA}`);
    } else {
      console.log(
        `==> OK. ${OLD_SCHEMA} intacto (usa --drop-old para borrarlo).`,
      );
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
