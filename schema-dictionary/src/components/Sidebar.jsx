import './components.css';
import TableList from './TableList';

export default function Sidebar({
  systems,
  systemId,
  onSystemChange,
  groups,
  groupFilter,
  onGroupFilter,
  search,
  onSearch,
  tables,
  selectedTable,
  onSelectTable,
  docView,
  onDocView,
  hasMigrationFlow,
  hasSecurityApi,
  hasIntakeSecurity,
}) {
  const activeSystem = systems.find((s) => s.id === systemId);

  const docLinks = [
    ...(hasMigrationFlow
      ? [{ id: 'migration', icon: '→', label: 'Migration Flow' }]
      : []),
    { id: 'bridge', icon: '⇄', label: 'Identity Bridge' },
    { id: 'api-migration', icon: '⤴', label: 'API Migration' },
    ...(hasSecurityApi ? [{ id: 'security-api', icon: '🔐', label: 'Security API' }] : []),
    ...(hasIntakeSecurity ? [{ id: 'intake-security', icon: '🛡', label: 'Intake Security' }] : []),
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar__section">
        <span className="sidebar__label">System</span>
        <div className="system-switcher">
          {systems.map((sys) => (
            <button
              key={sys.id}
              type="button"
              className={`system-switcher__btn ${systemId === sys.id ? 'is-active' : ''}`}
              onClick={() => onSystemChange(sys.id)}
            >
              {sys.name}
            </button>
          ))}
        </div>
        {activeSystem && (
          <p className="sidebar__db mono">{activeSystem.database}</p>
        )}
      </div>

      <div className="sidebar__section sidebar__section--nav">
        <span className="sidebar__label">Documentation</span>
        <div className="doc-nav">
          {docLinks.map((link) => (
            <button
              key={link.id}
              type="button"
              className={`bridge-link ${docView === link.id ? 'is-active' : ''}`}
              onClick={() => onDocView(docView === link.id ? null : link.id)}
            >
              <span className="bridge-link__icon">{link.icon}</span>
              {link.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar__section sidebar__section--grow">
        <span className="sidebar__label">Search tables</span>
        <input
          type="search"
          className="sidebar-search"
          placeholder="Table or column name…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          onFocus={() => {
            if (docView) onDocView(null);
          }}
        />

        <div className="group-filters">
          <button
            type="button"
            className={`group-filter ${groupFilter === 'all' ? 'is-active' : ''}`}
            onClick={() => onGroupFilter('all')}
          >
            All ({activeSystem?.tableCount ?? 0})
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`group-filter ${groupFilter === g.id ? 'is-active' : ''}`}
              onClick={() => onGroupFilter(g.id)}
            >
              {g.label.split(' ')[0]} ({g.tableCount})
            </button>
          ))}
        </div>

        <TableList
          tables={tables}
          selectedTable={selectedTable}
          onSelect={onSelectTable}
        />
      </div>
    </aside>
  );
}
