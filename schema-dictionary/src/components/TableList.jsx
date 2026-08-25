import './components.css';

export default function TableList({ tables, selectedTable, onSelect }) {
  if (!tables.length) {
    return <p className="table-list__empty">No tables match your filters.</p>;
  }

  const grouped = tables.reduce((acc, t) => {
    if (!acc[t.group]) acc[t.group] = { label: t.groupLabel, items: [] };
    acc[t.group].items.push(t);
    return acc;
  }, {});

  return (
    <nav className="table-list" aria-label="Tables">
      {Object.entries(grouped).map(([groupId, { label, items }]) => (
        <div key={groupId} className="table-list__group">
          <h3 className="table-list__group-title">{label}</h3>
          <ul className="table-list__items">
            {items.map((t) => (
              <li key={t.name}>
                <button
                  type="button"
                  className={`table-list__item ${selectedTable === t.name ? 'is-active' : ''}`}
                  onClick={() => onSelect(t.name)}
                >
                  <span className="table-list__name mono">{t.name}</span>
                  <span className="table-list__meta">
                    {t.kind === 'view' ? 'view' : `${t.columnCount} cols`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
