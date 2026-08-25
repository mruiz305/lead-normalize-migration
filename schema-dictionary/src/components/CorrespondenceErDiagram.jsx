import './components.css';

const COLOR = {
  teal: { stroke: '#0891b2', fill: 'rgba(8,145,178,0.12)', border: '#0891b2' },
  rose: { stroke: '#e11d48', fill: 'rgba(225,29,72,0.1)', border: '#e11d48' },
  violet: { stroke: '#7c3aed', fill: 'rgba(124,58,237,0.1)', border: '#7c3aed' },
  slate: { stroke: '#64748b', fill: 'rgba(100,116,139,0.12)', border: '#64748b' },
  amber: { stroke: '#d97706', fill: 'rgba(217,119,6,0.12)', border: '#d97706' },
  navy: { stroke: '#0f2744', fill: 'rgba(15,39,68,0.12)', border: '#0f2744' },
};

function palette(color) {
  return COLOR[color] || COLOR.teal;
}

export function CorrespondenceOverview({ overview, activeId, onSelect }) {
  if (!overview?.length) return null;

  return (
    <div className="er-diagram er-diagram--overview">
      <div className="er-overview-list">
        {overview.map((row) => {
          const c = palette(row.color);
          const active = row.legacyId === activeId;
          return (
            <button
              key={row.legacyId}
              type="button"
              className={`er-overview-row ${active ? 'is-active' : ''}`}
              onClick={() => onSelect?.(row.legacyId)}
              style={
                active
                  ? { borderColor: c.border, background: c.fill }
                  : undefined
              }
            >
              <span className="er-overview-row__legacy mono">
                {row.legacy.replace('dbProduction.', '')}
              </span>
              <span className="er-overview-row__arrow" aria-hidden>
                →
              </span>
              <span className="er-overview-row__dest">
                <strong>{row.targetLabel}</strong>
                <span className="er-overview-row__tables mono">
                  {row.targetTables.join(' · ')}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="er-diagram__hint">Clic en una fila para ver el detalle ER del origen.</p>
    </div>
  );
}

export function SourceCorrespondenceEr({ correspondence, onSelectTable }) {
  const groups = correspondence?.groups;
  if (!groups?.length) return null;

  const c = palette(correspondence.color);

  return (
    <div className="er-diagram er-diagram--detail">
      <div className="er-diagram__detail-head">
        <span
          className="er-diagram__detail-badge"
          style={{ borderColor: c.border, color: c.stroke }}
        >
          ER correspondencia
        </span>
        <code className="mono">{correspondence.legacy}</code>
        <span className="er-diagram__detail-arrow">→</span>
        <strong>{correspondence.database}</strong>
      </div>

      <div className="er-map" style={{ '--er-accent': c.stroke, '--er-border': c.border }}>
        <div
          className="er-map__legacy"
          style={{ borderColor: c.border, background: c.fill }}
        >
          <span className="er-map__legacy-name mono">{correspondence.legacyShort}</span>
          <span className="er-map__legacy-sub">entidad legacy</span>
          <span className="er-map__legacy-connector" aria-hidden />
        </div>

        <div className="er-map__groups">
          {groups.map((g) => (
            <div key={g.label} className="er-map__row">
              <div className="er-map__row-left">
                <span className="er-map__concept">{g.label}</span>
                <span className="er-map__cardinality">{g.cardinality}</span>
              </div>
              <span className="er-map__row-arrow" aria-hidden>
                →
              </span>
              <div className="er-map__row-right">
                <div className="er-map__chips">
                  {g.tables.map((table) => (
                    <button
                      key={table}
                      type="button"
                      className="table-chip table-chip--action"
                      onClick={() => onSelectTable?.(table, correspondence.database)}
                      title={`Abrir ${table} en el diccionario`}
                    >
                      {table}
                      <span className="table-chip__icon" aria-hidden>
                        ↗
                      </span>
                    </button>
                  ))}
                </div>
                <p className="er-map__note">{g.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
