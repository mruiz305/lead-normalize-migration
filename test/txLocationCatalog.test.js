require('./helpers/env');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { portalPointWkt } = require('../src/migration/txLocationCatalog');

describe('portalPointWkt', () => {
  it('arma el punto como la API lo lee: X = longitud, Y = latitud', () => {
    assert.equal(portalPointWkt('38.9831386', '-76.5352963'), 'POINT(-76.5352963 38.9831386)');
  });

  it('descarta pares vacíos, fuera de rango o 0,0', () => {
    assert.equal(portalPointWkt(null, '-76.5'), null);
    assert.equal(portalPointWkt('38.9', null), null);
    assert.equal(portalPointWkt('120', '-76.5'), null);
    assert.equal(portalPointWkt('38.9', '-200'), null);
    assert.equal(portalPointWkt(0, 0), null);
    assert.equal(portalPointWkt('abc', '-76.5'), null);
  });
});
