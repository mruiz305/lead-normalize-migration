import './components.css';

export default function TableDetail({ table, system }) {
  const incoming = table.incomingForeignKeys ?? [];
  const fkMap = Object.fromEntries(
    (table.foreignKeys ?? []).map((fk) => [fk.column, fk])
  );

  return (
    <article className="table-detail">
      <header className="table-detail__header">
        <div>
          <div className="table-detail__badges">
            <span className="badge badge--group">{table.groupLabel}</span>
            {table.kind === 'view' && <span className="badge badge--view">VIEW</span>}
          </div>
          <h2 className="table-detail__title mono">{table.name}</h2>
          {table.comment && <p className="table-detail__comment">{table.comment}</p>}
          {table.viewPreview && (
            <p className="table-detail__view-preview mono">{table.viewPreview}</p>
          )}
        </div>
        <div className="table-detail__stats">
          <div className="stat-card">
            <span className="stat-card__value">{table.columnCount}</span>
            <span className="stat-card__label">Columns</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__value">{table.foreignKeys?.length ?? 0}</span>
            <span className="stat-card__label">Outgoing FKs</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__value">{incoming.length}</span>
            <span className="stat-card__label">Incoming FKs</span>
          </div>
        </div>
      </header>

      {table.kind === 'view' && !table.columns.length ? (
        <section className="panel">
          <p className="panel__hint">
            View definition is in SQL source. Column list is derived at query time from the
            underlying SELECT.
          </p>
        </section>
      ) : (
        <section className="panel">
          <h3 className="panel__title">Columns</h3>
          <div className="columns-grid-wrap">
            <table className="columns-grid">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Nullable</th>
                  <th>Foreign Key</th>
                  <th>Comment</th>
                </tr>
              </thead>
              <tbody>
                {table.columns.map((col) => {
                  const fk = fkMap[col.name];
                  return (
                    <tr key={col.name}>
                      <td className="mono col-name">{col.name}</td>
                      <td className="mono col-type">{col.type}</td>
                      <td>
                        <span className={`null-badge ${col.nullable ? 'is-yes' : 'is-no'}`}>
                          {col.nullable ? 'YES' : 'NO'}
                        </span>
                      </td>
                      <td className="col-fk">
                        {fk ? (
                          <span className="fk-ref mono">
                            → {fk.referencesTable}.{fk.referencesColumn}
                          </span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className="col-comment">{col.comment || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(table.foreignKeys?.length > 0 || incoming.length > 0) && (
        <section className="panel">
          <h3 className="panel__title">Relationships</h3>
          <div className="relationships">
            {table.foreignKeys?.length > 0 && (
              <div className="relationships__block">
                <h4>References (outgoing)</h4>
                <ul>
                  {table.foreignKeys.map((fk) => (
                    <li key={fk.column} className="mono">
                      {table.name}.{fk.column} → {fk.referencesTable}.{fk.referencesColumn}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {incoming.length > 0 && (
              <div className="relationships__block">
                <h4>Referenced by (incoming)</h4>
                <ul>
                  {incoming.map((fk) => (
                    <li key={`${fk.fromTable}.${fk.column}`} className="mono">
                      {fk.fromTable}.{fk.column} → {table.name}.{fk.referencesColumn}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {table.name === 'app_user' && system.id === 'intake' && (
        <section className="panel panel--accent">
          <h3 className="panel__title">Cross-system link</h3>
          <p>
            Column <code className="mono">id_persona</code> bridges to{' '}
            <code className="mono">SECURITY_TNFG.persona</code>. Open the Identity Bridge
            panel in the sidebar for details.
          </p>
        </section>
      )}
    </article>
  );
}
