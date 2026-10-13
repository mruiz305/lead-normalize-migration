require('./helpers/env');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  mapCommentRow,
  upsertCommentBatch,
  resolveStartAfterId,
  OVERLAP_MINUTES,
} = require('../src/migration/leadCommentSync');

function fakeConn(answers = []) {
  const calls = [];
  let i = 0;
  return {
    calls,
    query: async (sql, params) => {
      calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      const next = answers[i++];
      return [next ?? { affectedRows: 0 }];
    },
  };
}

const maps = { userByEmail: new Map([['ana@tnfg.com', 7]]) };

describe('mapCommentRow', () => {
  it('resuelve el lead por glide_id, nunca por id_lead = IdLead', () => {
    // El lead Glide 600000 vive en id_lead 650000; el id_lead 600000 es otro lead.
    const byGlide = new Map([[600000, 650000], [580000, 600000]]);
    const row = mapCommentRow(
      { idComment: 9, IdLead: 600000, comment: ' hola ', posted: 'p', postedBy: 'Ana@TNFG.com' },
      byGlide,
      maps
    );
    assert.deepEqual(row, [9, 650000, 'comment', 'hola', 'p', 'Ana@TNFG.com', 7]);
  });

  it('devuelve null si el lead todavía no está en el modelo', () => {
    assert.equal(mapCommentRow({ idComment: 1, IdLead: 1 }, new Map(), maps), null);
  });
});

describe('upsertCommentBatch', () => {
  it('escribe glide_comment_id y deja id_note a la base', async () => {
    const conn = fakeConn([{ affectedRows: 3 }]);
    const res = await upsertCommentBatch(conn, [
      [1, 10, 'comment', 'a', 'p', null, null],
      [2, 11, 'comment', 'b', 'p', null, null],
    ]);
    const { sql, params } = conn.calls[0];
    assert.match(sql, /INSERT INTO .*lead_note.* \(glide_comment_id, id_lead, note_type, body, posted_at, posted_by, posted_by_user_id\)/);
    assert.doesNotMatch(sql, /\bid_note\b/);
    assert.match(sql, /ON DUPLICATE KEY UPDATE id_lead = VALUES\(id_lead\), body = VALUES\(body\)/);
    assert.equal(params.length, 14);
    assert.deepEqual(res, { written: 2, changed: 3 });
  });

  it('sin filas no toca la base', async () => {
    const conn = fakeConn();
    assert.deepEqual(await upsertCommentBatch(conn, []), { written: 0, changed: 0 });
    assert.equal(conn.calls.length, 0);
  });
});

describe('resolveStartAfterId', () => {
  it('sin comentarios Glide arranca desde 0', async () => {
    const target = fakeConn([[{ maxId: 0, lastPosted: null }]]);
    const source = fakeConn();
    assert.deepEqual(await resolveStartAfterId(source, target), { afterId: 0, since: null });
    assert.equal(source.calls.length, 0);
  });

  it('retrocede al primer idComment del solape cuando es menor que el cursor', async () => {
    const lastPosted = new Date('2026-10-13T19:50:00.000Z');
    const target = fakeConn([[{ maxId: 452634, lastPosted }]]);
    const source = fakeConn([[{ firstId: 452000 }]]);
    const { afterId, since } = await resolveStartAfterId(source, target);
    assert.equal(afterId, 451999);
    assert.equal(since.getTime(), lastPosted.getTime() - OVERLAP_MINUTES * 60000);
    assert.match(source.calls[0].sql, /WHERE posted >= \?/);
  });

  it('nunca avanza más allá del cursor por ids', async () => {
    const target = fakeConn([[{ maxId: 100, lastPosted: new Date() }]]);
    const source = fakeConn([[{ firstId: 500 }]]);
    const { afterId } = await resolveStartAfterId(source, target);
    assert.equal(afterId, 100);
  });
});
