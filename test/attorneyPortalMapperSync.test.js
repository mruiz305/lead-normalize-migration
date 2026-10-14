require('./helpers/env');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { diffMapper } = require('../src/migration/attorneyPortalMapperSync');

describe('diffMapper', () => {
  it('agrega, corrige y borra por id como prod', () => {
    const prod = [
      { id: 1, attorney_prod: 'Hess Will Assign', attorney_portal: 'Hess Will Assign (New Jersey)', createdAt: null },
      { id: 2, attorney_prod: 'Shulman & Hill Lawfirm (MVA)', attorney_portal: 'Shulman & Hill (WC)', createdAt: null },
      { id: 3, attorney_prod: ' ', attorney_portal: 'x', createdAt: null },
    ];
    const current = [
      { id: 1, attorney_prod: 'Hess Will Assign', attorney_portal: 'Hess Will Assign (New Jersey)' },
      { id: 2, attorney_prod: 'Shulman & Hill Lawfirm (MVA)', attorney_portal: 'Shulman & Hill' },
      { id: 9, attorney_prod: 'Viejo', attorney_portal: 'Viejo (Portal)' },
    ];
    const d = diffMapper(prod, current);
    assert.deepEqual(d.upserts.map((r) => r.id), [2]);
    assert.deepEqual(d.deletes, [9]);
    assert.equal(d.prodCount, 2);
  });
});
