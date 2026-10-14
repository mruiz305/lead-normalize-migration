require('./helpers/env');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { transformLead } = require('../src/migration/pipeline');
const { buildMaps } = require('./helpers/mapsStub');
const {
  PORTAL_GLIDE_FIELDS,
  buildPortalPatch,
  applyPortalPatch,
  diffPortalPatch,
  describeDiff,
  wallClockToUtcMs,
} = require('../src/migration/portalLeadGlideFields');

function lead(extra = {}) {
  return {
    idLead: 1001,
    firstName: 'Ana',
    lastName: 'Perez',
    phone: '3055551234',
    created: '2024-01-15 10:00:00',
    leadStatus: 'Signed',
    stage: 'Owned',
    attorney: 'Smith PA',
    legalStatus: 'Open',
    txLocation: 'Miami Clinic',
    clinicalStatus: 'Pending',
    dateCameIn: '2024-01-16 09:00:00',
    reasonDrop: null,
    ...extra,
  };
}

function fakeConn(answers = []) {
  const calls = [];
  let i = 0;
  return {
    calls,
    query: async (sql, params) => {
      calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      return [answers[i++] ?? { affectedRows: 1 }];
    },
  };
}

describe('buildPortalPatch', () => {
  it('toma solo estado, legal, clínica y fechas; nada del cliente ni del accidente', () => {
    const row = lead();
    const { patch, skipped } = buildPortalPatch(row, transformLead(row, buildMaps()));
    assert.deepEqual(Object.keys(patch).sort(), ['lead', 'lead_clinical', 'lead_legal', 'lead_timeline']);
    assert.equal(patch.lead.id_lead_status, 2);
    assert.equal(patch.lead.id_stage, 7);
    assert.equal(patch.lead_legal.id_attorney, 31);
    assert.equal(patch.lead_legal.id_legal_status, 1);
    assert.equal(patch.lead_clinical.id_tx_location, 41);
    assert.equal(patch.lead_timeline.date_came_in, '2024-01-16 09:00:00');
    assert.equal(patch.lead_timeline.reason_drop, null);
    assert.deepEqual(skipped, []);
    for (const t of Object.keys(patch)) {
      assert.ok(!('first_name' in patch[t]) && !('id_company_office' in patch[t]));
    }
  });

  it('un abogado o clínica que no matchea el catálogo se conserva del portal', () => {
    const row = lead({ attorney: 'Abogado Mal Tipeado', txLocation: 'Clinica X', leadStatus: 'Raro' });
    const { patch, skipped } = buildPortalPatch(row, transformLead(row, buildMaps()));
    assert.deepEqual(skipped.sort(), ['id_attorney', 'id_lead_status', 'id_tx_location']);
    assert.ok(!('id_attorney' in patch.lead_legal));
    assert.ok(!('id_tx_location' in patch.lead_clinical));
    assert.ok(!('id_lead_status' in patch.lead));
    assert.equal(patch.lead.id_stage, 7);
  });

  it('un valor vacío en Glide sí se escribe como NULL (quitaron el abogado)', () => {
    const row = lead({ attorney: '' });
    const { patch, skipped } = buildPortalPatch(row, transformLead(row, buildMaps()));
    assert.equal(patch.lead_legal.id_attorney, null);
    assert.deepEqual(skipped, []);
  });

  it('cada campo apunta a la columna correcta del array de transformLead', () => {
    // Si alguien reordena las columnas en pipeline.js, esto lo detecta.
    const row = lead({ dateLegalAccepted: 'LA', dateSigned: 'DS', visits: 4, ldot: 'LD', lkaDate: 'LKA' });
    const { patch } = buildPortalPatch(row, transformLead(row, buildMaps()));
    assert.equal(patch.lead_legal.date_legal_accepted, 'LA');
    assert.equal(patch.lead_legal.date_signed, 'DS');
    assert.equal(patch.lead_clinical.visits, 4);
    assert.equal(patch.lead_clinical.ldot, 'LD');
    assert.equal(patch.lead_timeline.lka_date, 'LKA');
    assert.equal(PORTAL_GLIDE_FIELDS.length, 26);
  });
});

describe('applyPortalPatch / diffPortalPatch', () => {
  it('diff reporta columnas que difieren y tablas sin fila', async () => {
    const conn = fakeConn([[{ id_lead_status: 1, id_stage: 0 }], [], [{ id_attorney: 1 }], []]);
    const diff = await diffPortalPatch(conn, 1, {
      lead: { id_lead_status: 2, id_stage: 7 },
      lead_timeline: { date_came_in: 'x' },
      lead_legal: { id_attorney: 31 },
      lead_clinical: { id_tx_location: null },
    });
    assert.deepEqual(diff, {
      lead: { missing: false, changed: ['id_stage'] },
      lead_timeline: { missing: true, changed: ['date_came_in'] },
    });
    assert.deepEqual(describeDiff(diff), ['lead.id_stage', 'lead_timeline:(sin fila)']);
  });

  it('UPDATE solo las columnas que difieren, INSERT la 1:1 que falta, nunca inserta lead', async () => {
    const conn = fakeConn([{ affectedRows: 1 }, { affectedRows: 1 }]);
    const n = await applyPortalPatch(conn, 650000, {
      lead: { id_lead_status: 2, id_stage: 7 },
      lead_legal: { id_attorney: 31, id_legal_status: null },
      lead_clinical: { id_tx_location: 41 },
    }, {
      lead: { missing: false, changed: ['id_stage'] },
      lead_legal: { missing: true, changed: ['id_attorney', 'id_legal_status'] },
    });
    assert.equal(n, 2);
    assert.equal(conn.calls.length, 2);
    assert.match(conn.calls[0].sql, /^UPDATE `tnfg_intake_test`.`lead` SET `id_stage` = \?, updated_at = NOW\(\) WHERE id_lead = \?$/);
    assert.deepEqual(conn.calls[0].params, [7, 650000]);
    assert.match(conn.calls[1].sql, /^INSERT INTO `tnfg_intake_test`.`lead_legal` \(id_lead, `id_attorney`, `id_legal_status`, created_at, updated_at\) VALUES \(\?, \?, \?, NOW\(\), NOW\(\)\)$/);
    assert.deepEqual(conn.calls[1].params, [650000, 31, null]);
  });
});

describe('fechas y filas 1:1', () => {
  it('las fechas van con la hora de pared tal cual, sin conversión de zona', () => {
    const row = lead({ dateSigned: '2026-10-12 09:49:00', ldot: '2026-10-12' });
    const { patch } = buildPortalPatch(row, transformLead(row, buildMaps()));
    assert.equal(patch.lead_legal.date_signed, '2026-10-12 09:49:00');
    assert.equal(patch.lead_clinical.ldot, '2026-10-12');
  });

  it('una 1:1 que falta y viene toda NULL no se inserta', async () => {
    const conn = fakeConn();
    const n = await applyPortalPatch(conn, 1, { lead_legal: { id_attorney: null, date_signed: null } },
      { lead_legal: { missing: true, changed: ['id_attorney', 'date_signed'] } });
    assert.equal(n, 0);
    assert.equal(conn.calls.length, 0);
  });
});

describe('wallClockToUtcMs', () => {
  it('convierte hora de pared de prod (NY, -4h) y de INTAKE (UTC) al mismo eje', () => {
    const ny = wallClockToUtcMs('2026-10-13 19:50:00', -4 * 3600);
    const utc = wallClockToUtcMs('2026-10-13 23:50:00', 0);
    assert.equal(ny, utc);
    const asDate = wallClockToUtcMs(new Date(2026, 9, 13, 19, 50, 0), -4 * 3600);
    assert.equal(asDate, utc);
    assert.equal(wallClockToUtcMs(null, 0), null);
  });
});
