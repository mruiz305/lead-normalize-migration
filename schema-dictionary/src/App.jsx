import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from './components/Sidebar';
import TableDetail from './components/TableDetail';
import BridgePanel from './components/BridgePanel';
import MigrationFlowPanel from './components/MigrationFlowPanel';
import ApiMigrationPanel from './components/ApiMigrationPanel';
import IntakeSecurityPanel from './components/IntakeSecurityPanel';
import SecurityApiPanel from './components/SecurityApiPanel';
import ContentNav from './components/ContentNav';
import ThemeToggle from './components/ThemeToggle';
import { useTheme } from './hooks/useTheme';
import './App.css';

const DOC_LABELS = {
  migration: 'Migration Flow',
  bridge: 'Identity Bridge',
  'api-migration': 'API Migration',
  'security-api': 'Security API',
  'intake-security': 'Intake Security',
};

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState(null);
  const [systemId, setSystemId] = useState('intake');
  const [selectedTable, setSelectedTable] = useState(null);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [docView, setDocView] = useState(null);
  const [returnTo, setReturnTo] = useState(null);

  useEffect(() => {
    fetch('/schema-catalog.json')
      .then((r) => {
        if (!r.ok) throw new Error('schema-catalog.json not found — run npm run schema:build');
        return r.json();
      })
      .then((data) => {
        setCatalog(data);
        if (data.migrationFlow) setDocView('migration');
      })
      .catch((e) => setError(e.message));
  }, []);

  const system = useMemo(
    () => catalog?.systems?.find((s) => s.id === systemId),
    [catalog, systemId]
  );

  const filteredTables = useMemo(() => {
    if (!system) return [];
    const q = search.trim().toLowerCase();
    return system.tables.filter((t) => {
      if (groupFilter !== 'all' && t.group !== groupFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.comment?.toLowerCase().includes(q) ||
        t.columns.some(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.comment?.toLowerCase().includes(q)
        )
      );
    });
  }, [system, search, groupFilter]);

  useEffect(() => {
    if (filteredTables.length && !filteredTables.find((t) => t.name === selectedTable)) {
      setSelectedTable(filteredTables[0].name);
    } else if (!filteredTables.length) {
      setSelectedTable(null);
    }
  }, [filteredTables, selectedTable]);

  const activeTable = system?.tables.find((t) => t.name === selectedTable);

  const openDocView = useCallback((next) => {
    setDocView(next);
    setReturnTo(null);
  }, []);

  const openTableFromSidebar = useCallback((name) => {
    setSelectedTable(name);
    setReturnTo(null);
    setDocView(null);
  }, []);

  const openTableFromPanel = useCallback((tableName, database, origin) => {
    setSystemId(database === 'SECURITY_TNFG' ? 'security' : 'intake');
    setGroupFilter('all');
    setSearch('');
    setSelectedTable(tableName);
    setReturnTo(origin);
    setDocView(null);
  }, []);

  const goBack = useCallback(() => {
    if (!returnTo) return;
    setDocView(returnTo.panel);
    setReturnTo(null);
  }, [returnTo]);

  const contentNav = useMemo(() => {
    if (docView && DOC_LABELS[docView]) {
      return {
        back: null,
        crumbs: [
          { label: 'Diccionario', onClick: () => openDocView(null) },
          { label: DOC_LABELS[docView], current: true },
        ],
      };
    }

    if (activeTable) {
      return {
        back: returnTo ? { label: returnTo.label, onClick: goBack } : null,
        crumbs: [
          { label: system?.name ?? 'Tablas', onClick: () => openDocView(null) },
          { label: activeTable.name, current: true, mono: true },
        ],
      };
    }

    return null;
  }, [docView, activeTable, returnTo, system?.name, openDocView, goBack]);

  useEffect(() => {
    if (!returnTo) return undefined;

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        goBack();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [returnTo, goBack]);

  if (error) {
    return (
      <div className="error-state">
        <strong>Failed to load catalog</strong>
        <span>{error}</span>
      </div>
    );
  }

  if (!catalog) {
    return <div className="loading">Loading schema catalog…</div>;
  }

  return (
    <div className="app" data-theme={theme}>
      <header className="app-header">
        <div className="app-header__brand">
          <div className="app-header__logo">TNFG</div>
          <div>
            <h1 className="app-header__title">Schema Dictionary</h1>
            <p className="app-header__subtitle">
              Intake &amp; Security data model reference
            </p>
          </div>
        </div>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </header>

      <div className="app-body">
        <Sidebar
          systems={catalog.systems}
          systemId={systemId}
          onSystemChange={(id) => {
            setSystemId(id);
            setGroupFilter('all');
            setSearch('');
            setReturnTo(null);
            setDocView(null);
          }}
          groups={system?.groups ?? []}
          groupFilter={groupFilter}
          onGroupFilter={setGroupFilter}
          search={search}
          onSearch={setSearch}
          tables={filteredTables}
          selectedTable={selectedTable}
          onSelectTable={openTableFromSidebar}
          docView={docView}
          onDocView={openDocView}
          hasMigrationFlow={Boolean(catalog.migrationFlow)}
          hasSecurityApi={Boolean(catalog.securityApi)}
          hasIntakeSecurity={Boolean(catalog.intakeSecurity)}
        />

        <main className="app-main">
          {contentNav && (
            <ContentNav back={contentNav.back} crumbs={contentNav.crumbs} />
          )}
          <div className="app-content">
            {docView === 'bridge' ? (
              <BridgePanel bridge={catalog.bridge} />
            ) : docView === 'migration' && catalog.migrationFlow ? (
              <MigrationFlowPanel
                migrationFlow={catalog.migrationFlow}
                onBrowseTables={() => openDocView(null)}
                onSelectTable={(tableName, database) =>
                  openTableFromPanel(tableName, database, {
                    panel: 'migration',
                    label: 'Migration Flow',
                  })
                }
              />
            ) : docView === 'api-migration' ? (
              <ApiMigrationPanel apiMigration={catalog.apiMigration} />
            ) : docView === 'security-api' && catalog.securityApi ? (
              <SecurityApiPanel securityApi={catalog.securityApi} />
            ) : docView === 'intake-security' && catalog.intakeSecurity ? (
              <IntakeSecurityPanel intakeSecurity={catalog.intakeSecurity} />
            ) : activeTable ? (
              <TableDetail table={activeTable} system={system} />
            ) : (
              <div className="loading">Select a table from the sidebar</div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
