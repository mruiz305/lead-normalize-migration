require('./helpers/env');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { upsertCatalogRows } = require('../src/migration/attorneyCatalog');

function fakeConn() {
  const calls = [];
  return {
    calls,
    query: async (sql, params) => {
      calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      return [{ affectedRows: sql.includes('UPDATE') && !sql.includes('INSERT') ? 2 : 0 }];
    },
  };
}

describe('upsertCatalogRows', () => {
  it('hace upsert por PK y apaga lo que ya no viene de prod, sin TRUNCATE ni FK off', async () => {
    const conn = fakeConn();
    const res = await upsertCatalogRows(conn, {
      table: '`db`.ref_attorney',
      pk: 'id_attorney',
      columns: ['id_attorney', 'display_name', 'is_active'],
      rows: [[1, 'A', 1], [2, 'B', 0]],
    });
    const sqls = conn.calls.map((c) => c.sql);
    assert.equal(sqls.some((s) => /TRUNCATE|FOREIGN_KEY_CHECKS/.test(s)), false);
    assert.match(sqls[0], /^INSERT INTO `db`.ref_attorney \(`id_attorney`, `display_name`, `is_active`\) VALUES \(\?, \?, \?\), \(\?, \?, \?\) ON DUPLICATE KEY UPDATE `display_name` = VALUES\(`display_name`\), `is_active` = VALUES\(`is_active`\)$/);
    assert.match(sqls[1], /UPDATE `db`.ref_attorney SET is_active = 0 WHERE is_active = 1 AND `id_attorney` NOT IN \(\?, \?\)/);
    assert.deepEqual(conn.calls[1].params, [1, 2]);
    assert.deepEqual(res, { upserted: 2, deactivated: 2 });
  });

  it('con prod vacío no apaga nada', async () => {
    const conn = fakeConn();
    const res = await upsertCatalogRows(conn, {
      table: 't', pk: 'id', columns: ['id', 'x'], rows: [],
    });
    assert.equal(conn.calls.length, 0);
    assert.deepEqual(res, { upserted: 0, deactivated: 0 });
  });

  it('valueSql envuelve el placeholder de una columna (geometría)', async () => {
    const conn = fakeConn();
    await upsertCatalogRows(conn, {
      table: 't', pk: 'id', columns: ['id', 'coordinates'], rows: [[1, 'POINT(0 0)']],
      valueSql: (c) => (c === 'coordinates' ? 'ST_GeomFromText(?, 0)' : '?'),
    });
    assert.match(conn.calls[0].sql, /VALUES \(\?, ST_GeomFromText\(\?, 0\)\)/);
  });
});
