import { useMemo, useState } from 'react';
import ContentNav from './ContentNav';
import './components.css';

const STATUS_LABELS = {
  tested: 'Probado',
  pending: 'Pendiente',
  future: 'Fase futura',
};

function StatusBadge({ status }) {
  return (
    <span className={`api-status api-status--${status}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function MethodBadge({ method }) {
  return <span className={`api-method api-method--${method.toLowerCase()}`}>{method}</span>;
}

function endpointId(blockId, ep) {
  return `${blockId}|${ep.method}|${ep.path}`;
}

function EndpointDetailView({ block, endpoint, onBack }) {
  const fullPath = `${block.basePath}/${endpoint.path}`.replace(/\/+/g, '/');

  return (
    <div className="api-migration-detail">
      <ContentNav
        back={{ label: 'Todos los endpoints', onClick: onBack }}
        crumbs={[
          { label: 'API Migration', onClick: onBack },
          { label: block.title, onClick: onBack },
          { label: `${endpoint.method} ${endpoint.path}`, current: true, mono: true },
        ]}
      />

      <header className="api-migration-detail__hero">
        <div className="api-migration-detail__method-row">
          <MethodBadge method={endpoint.method} />
          <StatusBadge status={endpoint.status} />
        </div>
        <code className="mono api-migration-detail__path">{fullPath}</code>
        <p className="api-migration-detail__portal">{endpoint.portal}</p>
      </header>

      <section className="panel">
        <h3 className="panel__title">Contexto</h3>
        <dl className="api-meta-dl">
          <div>
            <dt>Módulo</dt>
            <dd>{block.title}</dd>
          </div>
          <div>
            <dt>Portal axios</dt>
            <dd className="mono">{block.portalAxios}</dd>
          </div>
          <div>
            <dt>case-service</dt>
            <dd className="mono">{block.caseServiceRef}</dd>
          </div>
          <div>
            <dt>intake-api</dt>
            <dd className="mono">{block.intakeModule}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <h3 className="panel__title">Resumen rápido</h3>
        <div className="api-summary-chips">
          <div className="api-summary-chip">
            <span className="api-summary-chip__label">Legacy</span>
            <span>{endpoint.legacy}</span>
          </div>
          <div className="api-summary-chip api-summary-chip--accent">
            <span className="api-summary-chip__label">TNFG</span>
            <span>{endpoint.tnfg}</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <h3 className="panel__title">Contrato HTTP</h3>
        <p className="panel__hint">Misma ruta y forma de JSON que case-service.</p>
        <div className="api-contract-grid">
          <div className="api-contract-block">
            <span className="api-contract-block__label">Recibe</span>
            <pre className="api-contract-pre">{endpoint.request ?? '—'}</pre>
          </div>
          <div className="api-contract-block api-contract-block--accent">
            <span className="api-contract-block__label">Retorna</span>
            <pre className="api-contract-pre">{endpoint.response ?? '—'}</pre>
          </div>
        </div>
      </section>

      <section className="panel">
        <h3 className="panel__title">Migración de datos</h3>
        <div className="api-endpoint-detail__compare">
          <div className="api-endpoint-detail__col api-endpoint-detail__col--before">
            <span className="api-endpoint-detail__label">Antes (case-service)</span>
            <p>{endpoint.beforeDetail ?? `Legacy: ${endpoint.legacy}`}</p>
          </div>
          <div className="api-endpoint-detail__col api-endpoint-detail__col--after">
            <span className="api-endpoint-detail__label">Ahora (intake-api)</span>
            <p>{endpoint.nowDetail ?? `TNFG: ${endpoint.tnfg}`}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function ApiMigrationPanel({ apiMigration }) {
  const { meta, progress, blocks, diffs } = apiMigration;
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [blockFilter, setBlockFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');

  const methodOptions = useMemo(() => {
    const methods = new Set();
    for (const block of blocks) {
      for (const ep of block.endpoints) {
        methods.add(ep.method);
      }
    }
    return ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].filter((m) => methods.has(m));
  }, [blocks]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    for (const block of blocks) {
      const ep = block.endpoints.find((e) => endpointId(block.id, e) === selectedId);
      if (ep) return { block, endpoint: ep };
    }
    return null;
  }, [blocks, selectedId]);

  const filteredBlocks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return blocks
      .filter((block) => blockFilter === 'all' || block.id === blockFilter)
      .map((block) => {
        const endpoints = block.endpoints.filter((ep) => {
          if (methodFilter !== 'all' && ep.method !== methodFilter) return false;
          if (!q) return true;
          const haystack = [
            ep.method,
            ep.path,
            ep.portal,
            ep.legacy,
            ep.tnfg,
            ep.beforeDetail,
            ep.nowDetail,
            block.title,
            block.basePath,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(q);
        });
        return { ...block, endpoints };
      })
      .filter((block) => block.endpoints.length > 0);
  }, [blocks, blockFilter, methodFilter, search]);

  const totalEndpoints = blocks.reduce((n, b) => n + b.endpoints.length, 0);
  const visibleCount = filteredBlocks.reduce((n, b) => n + b.endpoints.length, 0);

  if (selected) {
    return (
      <article className="api-migration-panel">
        <EndpointDetailView
          block={selected.block}
          endpoint={selected.endpoint}
          onBack={() => setSelectedId(null)}
        />
      </article>
    );
  }

  return (
    <article className="api-migration-panel">
      <header className="api-migration-panel__header">
        <span className="api-migration-panel__icon">⤴</span>
        <div>
          <h2>{meta.title}</h2>
          <p>{meta.subtitle}</p>
        </div>
      </header>

      <section className="panel panel--accent">
        <h3 className="panel__title">Principio</h3>
        <p className="panel__hint">{meta.principle}</p>
      </section>

      <div className="api-architecture api-architecture--compact">
        <div className="api-arch-card">
          <span className="api-arch-card__label">Antes</span>
          <code className="mono">{meta.architecture.before}</code>
        </div>
        <div className="api-arch-card api-arch-card--target">
          <span className="api-arch-card__label">Después</span>
          <code className="mono">{meta.architecture.after}</code>
        </div>
      </div>

      <section className="panel">
        <h3 className="panel__title">Progreso</h3>
        <ul className="api-progress api-progress--compact">
          {progress.map((item) => (
            <li key={item.id} className="api-progress__item">
              <StatusBadge status={item.status} />
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel api-endpoints-browser">
        <div className="api-endpoints-browser__head">
          <div>
            <h3 className="panel__title">Endpoints</h3>
            <p className="panel__hint">
              {visibleCount} de {totalEndpoints} — toca uno para ver el detalle antes/después
            </p>
          </div>
        </div>

        <div className="api-endpoints-browser__toolbar">
          <input
            type="search"
            className="api-endpoints-browser__search"
            placeholder="Buscar ruta, pantalla, legacy, TNFG…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="api-endpoints-browser__filter"
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            aria-label="Filtrar por método HTTP"
          >
            <option value="all">Todos los métodos</option>
            {methodOptions.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
          <select
            className="api-endpoints-browser__filter"
            value={blockFilter}
            onChange={(e) => setBlockFilter(e.target.value)}
          >
            <option value="all">Todos los módulos</option>
            {blocks.map((block) => (
              <option key={block.id} value={block.id}>
                {block.title}
              </option>
            ))}
          </select>
        </div>

        {filteredBlocks.length === 0 ? (
          <p className="api-endpoints-browser__empty">No hay endpoints que coincidan con la búsqueda.</p>
        ) : (
          filteredBlocks.map((block) => (
            <div key={block.id} className="api-endpoint-group">
              <div className="api-endpoint-group__header">
                <h4 className="api-endpoint-group__title">{block.title}</h4>
                <span className="api-block__count">
                  {block.endpoints.filter((e) => e.status === 'tested').length}/{block.endpoints.length}
                </span>
              </div>
              <p className="api-endpoint-group__meta mono">
                {block.portalAxios} · {block.basePath}
              </p>
              <ul className="api-endpoint-list">
                {block.endpoints.map((ep) => (
                  <li key={endpointId(block.id, ep)}>
                    <button
                      type="button"
                      className="api-endpoint-list__item"
                      onClick={() => setSelectedId(endpointId(block.id, ep))}
                    >
                      <MethodBadge method={ep.method} />
                      <span className="api-endpoint-list__path mono">{ep.path}</span>
                      <span className="api-endpoint-list__portal">{ep.portal}</span>
                      <StatusBadge status={ep.status} />
                      <span className="api-endpoint-list__chevron" aria-hidden>
                        ›
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <details className="panel api-reference-details">
        <summary className="api-reference-details__summary">Variables de entorno y diferencias</summary>
        <div className="api-reference-details__body">
          <h4 className="panel__title">Variables de entorno (Portal)</h4>
          <div className="columns-grid-wrap">
            <table className="columns-grid">
              <thead>
                <tr>
                  <th>Variable</th>
                  <th>Antes</th>
                  <th>Después</th>
                  <th>Alcance</th>
                </tr>
              </thead>
              <tbody>
                {meta.envVars.map((v) => (
                  <tr key={v.name}>
                    <td className="mono col-name">{v.name}</td>
                    <td className="mono col-comment">{v.before}</td>
                    <td className="mono col-comment">{v.after}</td>
                    <td className="col-comment">{v.scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 className="panel__title">Diferencias intencionales</h4>
          <div className="columns-grid-wrap">
            <table className="columns-grid">
              <thead>
                <tr>
                  <th>Tema</th>
                  <th>case-service</th>
                  <th>intake-api</th>
                </tr>
              </thead>
              <tbody>
                {diffs.map((d) => (
                  <tr key={d.topic}>
                    <td className="col-name">{d.topic}</td>
                    <td className="col-comment">{d.legacy}</td>
                    <td className="col-comment">{d.tnfg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </article>
  );
}
