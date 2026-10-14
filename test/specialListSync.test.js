require('./helpers/env');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { diffSpecialList, normStatus } = require('../src/migration/specialListSync');

describe('diffSpecialList', () => {
  it('agrega lo nuevo, corrige el estado cambiado y borra lo que prod quitó', () => {
    const prod = [
      { ID: '100', STATUS: 'ACTIVE' },
      { ID: '200', STATUS: 'DROPPED' },
      { ID: ' 300 ', STATUS: 'ACTIVE' },
    ];
    const current = [
      { lead_key: '100', status_code: 'ACTIVE' },
      { lead_key: '200', status_code: 'ACTIVE' },
      { lead_key: '400', status_code: 'ACTIVE' },
    ];
    const d = diffSpecialList(prod, current);
    assert.deepEqual(d.upserts, [
      { key: '200', status: 'DROPPED', isNew: false },
      { key: '300', status: 'ACTIVE', isNew: true },
    ]);
    assert.deepEqual(d.deletes, ['400']);
  });

  it('ignora ids vacíos y no toca lo que ya coincide', () => {
    const d = diffSpecialList([{ ID: '', STATUS: 'ACTIVE' }, { ID: '1', STATUS: 'active' }], [{ lead_key: '1', status_code: 'ACTIVE' }]);
    assert.deepEqual(d.upserts, []);
    assert.deepEqual(d.deletes, []);
  });
});

describe('normStatus', () => {
  it('solo DROPPED es DROPPED, como el seed original', () => {
    assert.equal(normStatus('dropped'), 'DROPPED');
    assert.equal(normStatus('REF OUT'), 'ACTIVE');
    assert.equal(normStatus(null), 'ACTIVE');
  });
});
