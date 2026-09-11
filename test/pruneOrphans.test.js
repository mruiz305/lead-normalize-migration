const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  orphanIds,
  assertProdLooksHealthy,
} = require('../src/migration/pruneOrphans');

test('orphanIds: dest − prod', () => {
  const dest = [1, 2, 2100, 5];
  const prod = new Set([1, 2, 5, 9]);
  assert.deepEqual(orphanIds(dest, prod), [2100]);
});

test('assertProdLooksHealthy: aborta si prod vacío', () => {
  assert.throws(() => assertProdLooksHealthy(0, 100), /vacío/);
});

test('assertProdLooksHealthy: aborta si prod << dest', () => {
  assert.throws(() => assertProdLooksHealthy(50, 200), /80%/);
  assert.doesNotThrow(() => assertProdLooksHealthy(50, 200, { force: true }));
  assert.doesNotThrow(() => assertProdLooksHealthy(182000, 184000));
});
