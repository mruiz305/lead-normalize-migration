const { test } = require('node:test');
const assert = require('node:assert/strict');
const { flush } = require('../src/migration/glideMirror');

function fakeConn() {
  const calls = [];
  return {
    calls,
    beginTransaction: async () => calls.push('BEGIN'),
    commit: async () => calls.push('COMMIT'),
    rollback: async () => calls.push('ROLLBACK'),
    query: async (sql, params) => {
      calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      return [{}];
    },
  };
}

const SPEC = {
  table: 'lead_legal_clinical_status',
  columns: ['glide_status_id', 'id_lead', 'legal_status'],
  uniqueLead: true,
};

test('flush uniqueLead: borra Id reasignados antes del upsert', async () => {
  const conn = fakeConn();
  await flush(conn, SPEC, [
    [8553, 436563, 'Confirmed'],
    [8554, 441244, 'CONFIRMED'],
  ]);

  assert.equal(conn.calls[0], 'BEGIN');
  const del = conn.calls[1];
  assert.match(del.sql, /^DELETE FROM .*lead_legal_clinical_status/);
  assert.match(del.sql, /\(glide_status_id, id_lead\) NOT IN \(\(\?, \?\), \(\?, \?\)\)/);
  assert.deepEqual(del.params, [
    [8553, 8554],
    [436563, 441244],
    8553, 436563,
    8554, 441244,
  ]);
  assert.match(conn.calls[2].sql, /^INSERT INTO .*ON DUPLICATE KEY UPDATE/);
  assert.equal(conn.calls[3], 'COMMIT');
});

test('flush sin uniqueLead: solo upsert', async () => {
  const conn = fakeConn();
  await flush(conn, { ...SPEC, uniqueLead: false }, [[1, 10, 'x']]);
  assert.deepEqual(
    conn.calls.filter((c) => typeof c === 'object').map((c) => c.sql.split(' ')[0]),
    ['INSERT']
  );
});

test('flush: rollback si falla la escritura', async () => {
  const conn = fakeConn();
  conn.query = async () => {
    throw new Error("Duplicate entry '436563'");
  };
  await assert.rejects(flush(conn, SPEC, [[8553, 436563, 'Confirmed']]), /Duplicate/);
  assert.deepEqual(conn.calls, ['BEGIN', 'ROLLBACK']);
});
