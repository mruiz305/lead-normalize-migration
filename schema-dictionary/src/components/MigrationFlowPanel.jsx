import { useState } from 'react';
import { CorrespondenceOverview, SourceCorrespondenceEr } from './CorrespondenceErDiagram';
import './components.css';

const COLOR_CLASS = {
  teal: 'flow-card--teal',
  rose: 'flow-card--rose',
  violet: 'flow-card--violet',
  slate: 'flow-card--slate',
  amber: 'flow-card--amber',
  navy: 'flow-card--navy',
};

const COLOR_DOT = {
  teal: '#0891b2',
  rose: '#e11d48',
  violet: '#7c3aed',
  slate: '#64748b',
  amber: '#d97706',
  navy: '#0f2744',
};

function shortLegacyName(legacy) {
  const parts = legacy.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : legacy;
}

function mappingTitle(dest) {
  if (dest.label) return dest.label;
  const dash = dest.note.indexOf(' — ');
  if (dash > 0) return dest.note.slice(0, dash);
  const hyphen = dest.note.indexOf(' - ');
  if (hyphen > 0) return dest.note.slice(0, hyphen);
  return dest.note;
}

function mappingDetail(dest) {
  if (dest.label) return dest.note;
  const dash = dest.note.indexOf(' — ');
  if (dash > 0) return dest.note.slice(dash + 3);
  const hyphen = dest.note.indexOf(' - ');
  if (hyphen > 0) return dest.note.slice(hyphen + 3);
  return '';
}

export default function MigrationFlowPanel({ migrationFlow, onSelectTable, onBrowseTables }) {
  const {
    pipeline,
    sources,
    columnGroups,
    gUsersColumnGroups,
    correspondenceOverview,
    sourceCorrespondence,
    title,
    description,
  } = migrationFlow;
  const [activeSourceId, setActiveSourceId] = useState(sources[0]?.id ?? null);
  const [expandedGroup, setExpandedGroup] = useState(null);

  const activeSource = sources.find((s) => s.id === activeSourceId) ?? sources[0];
  const db = activeSource?.database || 'TNFG_INTAKE';
  const activeCorrespondence = sourceCorrespondence?.[activeSource?.id];

  return (
    <article className="migration-flow">
      <header className="migration-flow__hero">
        <div className="migration-flow__hero-text">
          <p className="migration-flow__eyebrow">Referencia de datos</p>
          <h2>{title}</h2>
          <p>{description}</p>
          {onBrowseTables && (
            <button type="button" className="migration-flow__browse" onClick={onBrowseTables}>
              Explorar tablas del diccionario →
            </button>
          )}
        </div>
        <div className="migration-flow__legend" aria-hidden>
          <div className="migration-flow__legend-item">
            <span className="migration-flow__legend-box migration-flow__legend-box--legacy" />
            Origen legacy
          </div>
          <span className="migration-flow__legend-arrow">→</span>
          <div className="migration-flow__legend-item">
            <span className="migration-flow__legend-box migration-flow__legend-box--dest" />
            Tabla TNFG
          </div>
        </div>
      </header>

      <section className="panel migration-flow__section">
        <h3 className="panel__title">Fases de carga del modelo</h3>
        <ol className="migration-stepper">
          {pipeline.map((step, i) => (
            <li key={step.step} className="migration-stepper__step">
              <div className="migration-stepper__marker">
                <span className="migration-stepper__num">{step.step}</span>
                {i < pipeline.length - 1 && <span className="migration-stepper__line" aria-hidden />}
              </div>
              <div className="migration-stepper__body">
                <strong>{step.label}</strong>
                <span className="migration-stepper__target mono">{step.target}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {correspondenceOverview?.length > 0 && (
        <section className="panel migration-flow__section">
          <h3 className="panel__title">Diagrama ER — correspondencia legacy → TNFG</h3>
          <p className="migration-flow__hint">
            Vista entidad-relación: cada origen de producción se descompone en tablas del modelo. Las
            líneas indican cardinalidad (1:1, 1:N).
          </p>
          <CorrespondenceOverview
            overview={correspondenceOverview}
            activeId={activeSource?.id}
            onSelect={setActiveSourceId}
          />
          {activeCorrespondence && (
            <SourceCorrespondenceEr
              correspondence={activeCorrespondence}
              onSelectTable={onSelectTable}
            />
          )}
        </section>
      )}

      <section className="panel migration-flow__section">
        <div className="migration-flow__section-head">
          <h3 className="panel__title">De dónde sale cada tabla</h3>
          <p className="migration-flow__hint">
            Elige un origen legacy. Cada fila muestra qué tablas en TNFG reciben esos datos.
          </p>
        </div>

        <div className="source-tabs" role="tablist" aria-label="Orígenes legacy">
          {sources.map((src) => {
            const active = src.id === activeSource?.id;
            return (
              <button
                key={src.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`source-tab ${active ? 'is-active' : ''}`}
                onClick={() => setActiveSourceId(src.id)}
              >
                <span
                  className="source-tab__dot"
                  style={{ background: COLOR_DOT[src.color] || COLOR_DOT.teal }}
                />
                <span className="source-tab__name">{shortLegacyName(src.legacy)}</span>
                <span className="source-tab__count">{src.destinations.length}</span>
              </button>
            );
          })}
        </div>

        {activeSource && (
          <div
            className={`source-detail ${COLOR_CLASS[activeSource.color] || ''}`}
            role="tabpanel"
          >
            <div className="source-detail__banner">
              <div className="source-detail__from">
                <span className="source-detail__label">Origen legacy</span>
                <code className="mono source-detail__legacy">{activeSource.legacy}</code>
                <p className="source-detail__summary">{activeSource.summary}</p>
              </div>
              <div className="source-detail__arrow" aria-hidden>
                <span>mapea a</span>
                <strong>→</strong>
              </div>
              <div className="source-detail__to">
                <span className="source-detail__label">Base destino</span>
                <span className="source-detail__db">{db}</span>
                <p className="source-detail__meta">
                  {activeSource.volume}
                  {' · '}
                  {activeSource.destinations.length} grupos de tablas
                </p>
              </div>
            </div>

            <div className="mapping-table-wrap">
              <table className="mapping-table">
                <thead>
                  <tr>
                    <th scope="col">Concepto</th>
                    <th scope="col">Tablas TNFG</th>
                    <th scope="col">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSource.destinations.map((dest) => {
                    const detail = mappingDetail(dest);
                    return (
                      <tr key={dest.tables.join('-')}>
                        <td className="mapping-table__concept">
                          <span className="mapping-table__concept-title">
                            {mappingTitle(dest)}
                          </span>
                        </td>
                        <td className="mapping-table__tables">
                          <div className="mapping-table__chips">
                            {dest.tables.map((t) => (
                              <button
                                key={t}
                                type="button"
                                className="table-chip table-chip--action"
                                onClick={() => onSelectTable(t, db)}
                                title={`Abrir ${t} en el diccionario`}
                              >
                                {t}
                                <span className="table-chip__icon" aria-hidden>
                                  ↗
                                </span>
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="mapping-table__detail">
                          {detail || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {activeSource.notes?.length > 0 && (
              <ul className="source-detail__notes">
                {activeSource.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {columnGroups?.length > 0 && (
        <section className="panel migration-flow__section">
          <h3 className="panel__title">tblLeads — columna por columna</h3>
          <p className="migration-flow__hint">
            Detalle campo a campo de la tabla ancha original (~189 columnas).
          </p>
          <ColumnGroupAccordion groups={columnGroups} expandedGroup={expandedGroup} setExpandedGroup={setExpandedGroup} />
        </section>
      )}

      {gUsersColumnGroups?.length > 0 && (
        <section className="panel migration-flow__section">
          <h3 className="panel__title">g_users — columna por columna</h3>
          <p className="migration-flow__hint">
            Staff representantes (~2.5K filas). Compensación jul 2026:{' '}
            <code className="mono">DealGoal</code> → <code className="mono">hr_deal_goal</code>,{' '}
            <code className="mono">DealGoalCustom</code> → <code className="mono">hr_deal_goal_custom</code>,{' '}
            <code className="mono">paylocityId</code> → <code className="mono">paylocity_id</code>.
            Backfill: <code className="mono">npm run backfill:app-user-deal-paylocity</code>.
          </p>
          <ColumnGroupAccordion
            groups={gUsersColumnGroups}
            expandedGroup={expandedGroup}
            setExpandedGroup={setExpandedGroup}
            idPrefix="gu-"
          />
        </section>
      )}
    </article>
  );
}

function ColumnGroupAccordion({ groups, expandedGroup, setExpandedGroup, idPrefix = '' }) {
  return (
    <div className="column-groups">
      {groups.map((g) => {
        const groupKey = `${idPrefix}${g.id}`;
        const open = expandedGroup === groupKey;
        return (
          <div key={groupKey} className={`column-group ${open ? 'is-open' : ''}`}>
            <button
              type="button"
              className="column-group__head"
              onClick={() => setExpandedGroup(open ? null : groupKey)}
            >
              <span className="column-group__title">{g.title}</span>
              <span className="column-group__count">{g.rows.length} cols</span>
              <span className="flow-card__chevron">{open ? '−' : '+'}</span>
            </button>
            {open && (
              <div className="column-group__body">
                {g.subtitle && <p className="column-group__subtitle">{g.subtitle}</p>}
                <table className="column-map-table">
                  <thead>
                    <tr>
                      <th>Columna g_users</th>
                      <th>Destino TNFG</th>
                      <th>Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map(([srcCol, dest, note]) => (
                      <tr key={srcCol}>
                        <td>
                          <code className="mono">{srcCol}</code>
                        </td>
                        <td>{dest}</td>
                        <td className="column-map-table__note">{note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
