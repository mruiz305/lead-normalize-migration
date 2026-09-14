require('./helpers/env');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveSince,
  fmtSql,
  minusMinutes,
  OVERLAP_MINUTES,
} = require('../scripts/sync-incremental');

// Reloj de prod en el momento de la corrida.
const nowOnSource = new Date(2026, 8, 14, 2, 0, 0); // 2026-09-14 02:00:00
const ceiling = fmtSql(minusMinutes(nowOnSource, OVERLAP_MINUTES));

describe('resolveSince', () => {
  it('--since explícito manda sin tocarlo', () => {
    const since = resolveSince({ since: '2026-01-01 00:00:00' }, null, nowOnSource);
    assert.equal(since, '2026-01-01 00:00:00');
  });

  it('--hours cuenta desde el reloj de prod, no el de la máquina', () => {
    const since = resolveSince({ hours: 6 }, null, nowOnSource);
    assert.equal(since, '2026-09-13 20:00:00');
  });

  it('sin estado previo mira 24 h hacia atrás', () => {
    const since = resolveSince({}, null, nowOnSource);
    assert.equal(since, '2026-09-13 02:00:00');
  });

  it('usa lastSyncAt del estado cuando está en el pasado', () => {
    const since = resolveSince({}, { lastSyncAt: '2026-09-14 01:30:00' }, nowOnSource);
    assert.equal(since, '2026-09-14 01:30:00');
  });

  // El bug real: el estado quedó escrito en UTC mientras prod corre en
  // America/New_York, así que lastSyncAt apuntaba 4 h hacia adelante y el
  // filtro `updated >= since` no matcheaba una sola fila.
  it('un lastSyncAt adelantado al reloj de prod se recorta al techo', () => {
    const adelantado = '2026-09-14 06:00:00';
    const since = resolveSince({}, { lastSyncAt: adelantado }, nowOnSource);
    assert.equal(since, ceiling);
    assert.ok(since < fmtSql(nowOnSource), 'el since nunca puede quedar en el futuro de prod');
  });

  it('el techo deja un solapamiento hacia atrás, no corta justo en el ahora', () => {
    assert.equal(ceiling, '2026-09-14 01:50:00');
  });
});
