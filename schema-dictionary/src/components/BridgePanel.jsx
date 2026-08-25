import './components.css';

export default function BridgePanel({ bridge }) {
  return (
    <article className="bridge-panel">
      <header className="bridge-panel__header">
        <span className="bridge-panel__icon">⇄</span>
        <div>
          <h2>{bridge.title}</h2>
          <p>{bridge.description}</p>
        </div>
      </header>

      <div className="bridge-diagram">
        <div className="bridge-card">
          <span className="bridge-card__system">Intake</span>
          <code className="mono bridge-card__path">
            {bridge.intake.database}.{bridge.intake.table}.{bridge.intake.column}
          </code>
          <span className="bridge-card__type">{bridge.intake.type}</span>
        </div>
        <div className="bridge-arrow" aria-hidden>
          <span className="bridge-arrow__line" />
          <span className="bridge-arrow__label">logical FK</span>
        </div>
        <div className="bridge-card bridge-card--security">
          <span className="bridge-card__system">Security</span>
          <code className="mono bridge-card__path">
            {bridge.security.database}.{bridge.security.table}.{bridge.security.column}
          </code>
          <span className="bridge-card__type">{bridge.security.type}</span>
        </div>
      </div>

      <section className="panel">
        <h3 className="panel__title">Sync path</h3>
        <ol className="sync-path">
          {bridge.syncPath.map((step, i) => (
            <li key={i} className="mono">
              {step}
            </li>
          ))}
        </ol>
      </section>

      <section className="panel">
        <h3 className="panel__title">Implementation notes</h3>
        <ul className="bridge-notes">
          {bridge.notes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      </section>

      <section className="panel panel--accent">
        <h3 className="panel__title">persona_sistema_origen</h3>
        <p>
          SECURITY tracks legacy IDs via{' '}
          <code className="mono">persona_sistema_origen</code> with{' '}
          <code className="mono">source_system = INTAKE_APP_USER</code> and{' '}
          <code className="mono">external_id = app_user.id_user</code>. Use both the FK column
          and origin link for reconciliation during migration.
        </p>
      </section>
    </article>
  );
}
