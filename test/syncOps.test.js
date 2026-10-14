require('./helpers/env');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { plan, parseArgs } = require('../scripts/sync-ops');

describe('sync:ops plan', () => {
  it('refresca abogados y clínicas antes de los leads', () => {
    const steps = plan(parseArgs([])).map((s) => s.script);
    const attorney = steps.indexOf('sync:ref-attorney');
    const clinics = steps.indexOf('sync:ref-tx-location');
    const leads = steps.indexOf('sync:incremental');
    assert.ok(attorney >= 0);
    assert.ok(clinics > attorney);
    assert.ok(leads > clinics);
  });

  it('--skip-attorney y --skip-clinics sacan cada catálogo', () => {
    const steps = plan(parseArgs(['--skip-attorney', '--skip-clinics'])).map((s) => s.script);
    assert.equal(steps.includes('sync:ref-attorney'), false);
    assert.equal(steps.includes('sync:ref-tx-location'), false);
  });

  it('copia el mapper de nombres de abogado junto con los abogados', () => {
    assert.equal(plan(parseArgs([])).some((s) => s.script === 'sync:attorney-mapper'), true);
    assert.equal(plan(parseArgs(['--skip-attorney'])).some((s) => s.script === 'sync:attorney-mapper'), false);
  });

  it('sincroniza la lista especial en cada ciclo, salvo --skip-special-list', () => {
    assert.equal(plan(parseArgs([])).some((s) => s.script === 'sync:special-list'), true);
    assert.equal(plan(parseArgs(['--skip-special-list'])).some((s) => s.script === 'sync:special-list'), false);
  });

  it('--with-catalogs no duplica el sync puntual', () => {
    const steps = plan(parseArgs(['--with-catalogs'])).map((s) => s.script);
    assert.equal(steps.includes('copy-catalogs'), true);
    assert.equal(steps.includes('sync:ref-attorney'), false);
    assert.equal(steps.includes('sync:ref-tx-location'), false);
  });
});
