import { useMemo, useState } from 'react';
import ContentNav from './ContentNav';
import './components.css';

const AUTH_LABELS = {
  none: 'Público',
  'security-jwt': 'JWT Security',
  'portal-jwt': 'JWT Portal',
};

function MethodBadge({ method }) {
  return <span className={`api-method api-method--${method.toLowerCase()}`}>{method}</span>;
}

function AuthBadge({ auth }) {
  return (
    <span className={`security-auth-badge security-auth-badge--${auth}`}>
      {AUTH_LABELS[auth] ?? auth}
    </span>
  );
}

function endpointKey(blockId, ep) {
  return `${blockId}|${ep.method}|${ep.path}`;
}

function EndpointDetailView({ block, ep, onBack }) {
  const fullPath = block.basePath + (ep.path ? `/${ep.path}` : '');
  const normalizedPath = fullPath.replace(/\/+/g, '/');
  const dualNote =
    block.dualRoute === false
      ? 'Ruta única (sin prefijo /api duplicado)'
      : `También disponible sin /api: ${normalizedPath.replace(/^\/api/, '') || normalizedPath}`;

  return (
    <div className="api-migration-detail">
      <ContentNav
        back={{ label: 'Todos los endpoints', onClick: onBack }}
        crumbs={[
          { label: 'Security API', onClick: onBack },
          { label: block.title, onClick: onBack },
          { label: `${ep.method} ${ep.path || '/'}`, current: true, mono: true },
        ]}
      />

      <header className="api-migration-detail__hero">
        <div className="api-migration-detail__method-row">
          <MethodBadge method={ep.method} />
          <AuthBadge auth={block.auth} />
        </div>
        <code className="mono api-migration-detail__path">{normalizedPath}</code>
        <p className="api-migration-detail__portal">{ep.summary}</p>
      </header>

        <section className="panel">
          <h3 className="panel__title">Módulo</h3>
          <p>{block.description}</p>
          <dl className="api-meta-dl">
            <div>
              <dt>Consumidor</dt>
              <dd>{block.consumer}</dd>
            </div>
            <div>
              <dt>Auth</dt>
              <dd>{AUTH_LABELS[block.auth]}</dd>
            </div>
            <div>
              <dt>Rutas</dt>
              <dd>{dualNote}</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <h3 className="panel__title">Contrato HTTP</h3>
          <div className="api-contract-grid">
            <div className="api-contract-block">
              <span className="api-contract-block__label">Recibe</span>
              <pre className="api-contract-pre">{ep.request ?? '—'}</pre>
            </div>
            <div className="api-contract-block api-contract-block--accent">
              <span className="api-contract-block__label">Retorna</span>
              <pre className="api-contract-pre">{ep.response ?? '—'}</pre>
            </div>
          </div>
        </section>
      </div>
  );
}

export default function SecurityApiPanel({ securityApi }) {
  const { meta, blocks, stats } = securityApi;
  const [selectedKey, setSelectedKey] = useState(null);
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

  const flat = useMemo(() => {
    const rows = [];
    for (const block of blocks) {
      for (const ep of block.endpoints) {
        rows.push({ block, ep });
      }
    }
    return rows;
  }, [blocks]);

  const selected = selectedKey
    ? flat.find(({ block, ep }) => endpointKey(block.id, ep) === selectedKey)
    : null;

  const filteredBlocks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return blocks
      .filter((block) => blockFilter === 'all' || block.id === blockFilter)
      .map((block) => {
        const endpoints = block.endpoints.filter((ep) => {
          if (methodFilter !== 'all' && ep.method !== methodFilter) return false;
          if (!q) return true;
          const path = `${block.basePath}/${ep.path}`.replace(/\/+/g, '/').toLowerCase();
          return (
            block.title.toLowerCase().includes(q) ||
            path.includes(q) ||
            ep.method.toLowerCase().includes(q) ||
            ep.summary?.toLowerCase().includes(q)
          );
        });
        return { ...block, endpoints };
      })
      .filter((block) => block.endpoints.length > 0);
  }, [blocks, blockFilter, methodFilter, search]);

  const visibleCount = filteredBlocks.reduce((n, b) => n + b.endpoints.length, 0);

  if (selected) {
    return (
      <article className="api-migration-panel">
        <EndpointDetailView
          block={selected.block}
          ep={selected.ep}
          onBack={() => setSelectedKey(null)}
        />
      </article>
    );
  }

  return (
    <article className="api-migration-panel">
      <header className="api-migration-panel__header">
        <span className="api-migration-panel__icon">🔐</span>
        <div>
          <h2>{meta.title}</h2>
          <p>{meta.subtitle}</p>
        </div>
      </header>

      <section className="panel panel--accent">
        <h3 className="panel__title">Principio</h3>
        <p className="panel__hint">{meta.principle}</p>
        <div className="security-api-stats">
          <span>
            <strong>{stats.operations}</strong> operaciones
          </span>
          <span>
            <strong>{stats.modules}</strong> módulos
          </span>
          <span className="mono">{meta.baseUrl.local}</span>
        </div>
      </section>

      <section className="panel">
        <h3 className="panel__title">Clientes</h3>
        <div className="security-api-clients">
          {meta.clients.map((c) => (
            <div key={c.id} className="security-api-client-card">
              <strong>{c.label}</strong>
              {c.env && <code className="mono">{c.env}</code>}
              {c.note && <span className="muted">{c.note}</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="panel api-endpoints-browser">
        <div className="api-endpoints-browser__head">
          <div>
            <h3 className="panel__title">Endpoints</h3>
            <p className="panel__hint">
              {visibleCount} de {stats.operations} — toca uno para ver el detalle del módulo
            </p>
          </div>
        </div>

        <div className="api-endpoints-browser__toolbar">
          <input
            type="search"
            className="api-endpoints-browser__search"
            placeholder="Buscar ruta, módulo o descripción…"
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
                <AuthBadge auth={block.auth} />
              </div>
              <p className="api-endpoint-group__meta mono">
                {block.consumer} · {block.basePath}
              </p>
              <ul className="api-endpoint-list">
                {block.endpoints.map((ep) => {
                  const key = endpointKey(block.id, ep);
                  const path = ep.path ? `/${ep.path}` : '';
                  const fullPath = `${block.basePath}${path}`.replace(/\/+/g, '/');
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        className="api-endpoint-list__item api-endpoint-list__item--no-status"
                        onClick={() => setSelectedKey(key)}
                      >
                        <MethodBadge method={ep.method} />
                        <span className="api-endpoint-list__path mono">{fullPath}</span>
                        <span className="api-endpoint-list__portal">{ep.summary}</span>
                        <span className="api-endpoint-list__chevron" aria-hidden>
                          ›
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>
    </article>
  );
}
