import './components.css';

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <span className="stat-card__value">{value}</span>
      <span className="stat-card__label">{label}</span>
    </div>
  );
}

export default function IntakeSecurityPanel({ intakeSecurity }) {
  if (!intakeSecurity) return null;
  const { meta, seeds, intakeRoles, portalBridgeRoles, vistas, apiAcl, stats } = intakeSecurity;

  return (
    <div className="intake-security-panel">
      <header className="panel-hero">
        <h2 className="panel-hero__title">{meta.title}</h2>
        <p className="panel-hero__subtitle">{meta.subtitle}</p>
        <p className="panel-hero__principle">{meta.principle}</p>
        <div className="stat-row">
          <StatCard label="Roles INTAKE" value={stats.intakeRoles} />
          <StatCard label="Bridge portal" value={stats.portalBridgeRoles} />
          <StatCard label="Vistas ACL" value={stats.vistas} />
          <StatCard label="Reglas API" value={stats.apiAclRows} />
        </div>
      </header>

      <section className="panel">
        <h3 className="panel__title">JWT — campos de autorización</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Campo</th>
              <th>Tipo</th>
              <th>Uso</th>
            </tr>
          </thead>
          <tbody>
            {meta.jwtFields.map((f) => (
              <tr key={f.field}>
                <td className="mono">{f.field}</td>
                <td className="mono">{f.type}</td>
                <td>{f.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h3 className="panel__title">Seeds SECURITY (local/dev)</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>npm script</th>
              <th>SQL</th>
              <th>Descripción</th>
            </tr>
          </thead>
          <tbody>
            {seeds.map((s) => (
              <tr key={s.script}>
                <td className="mono">{s.script}</td>
                <td className="mono">{s.sql}</td>
                <td>{s.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h3 className="panel__title">Roles INTAKE (id_sistema = INTAKE)</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>role_code</th>
              <th>Perfil</th>
              <th>Permisos clave</th>
            </tr>
          </thead>
          <tbody>
            {intakeRoles.map((r) => (
              <tr key={r.code}>
                <td className="mono">{r.code}</td>
                <td>{r.profile}</td>
                <td>{r.keyPerms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h3 className="panel__title">Bridge portal ↔ intake (PORTAL_ABOGADOS)</h3>
        <p className="panel__lead">
          Staff con rol INTAKE también necesita un rol portal bridge para ver pantallas en el Portal
          (PermissionGuard). Sin permisos doctor/lawyer, performance ni payments.
        </p>
        <table className="data-table">
          <thead>
            <tr>
              <th>role_code</th>
              <th>Permisos portal</th>
              <th>Perfiles intake</th>
              <th>Pantallas</th>
            </tr>
          </thead>
          <tbody>
            {portalBridgeRoles.map((r) => (
              <tr key={r.code}>
                <td className="mono">{r.code}</td>
                <td className="mono">{r.portalPerms.join(', ')}</td>
                <td className="mono">{r.intakeRoles.join(', ')}</td>
                <td>{r.portalScreens}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h3 className="panel__title">Vistas ACL INTAKE</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>vista_code</th>
              <th>Etiqueta</th>
              <th>Ruta UI</th>
            </tr>
          </thead>
          <tbody>
            {vistas.map((v) => (
              <tr key={v.code}>
                <td className="mono">{v.code}</td>
                <td>{v.label}</td>
                <td className="mono">{v.route ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h3 className="panel__title">intake-api — endpoint → ACL</h3>
        <p className="panel__lead">
          Validación en <span className="mono">IntakeAclGuard</span>: primero{' '}
          <span className="mono">acl_intake[vista]</span> incluye acción; si no, fallback a{' '}
          <span className="mono">permissions</span> portal legacy.
        </p>
        <table className="data-table">
          <thead>
            <tr>
              <th>Rutas</th>
              <th>Vista</th>
              <th>Acción</th>
              <th>Fallback portal</th>
            </tr>
          </thead>
          <tbody>
            {apiAcl.map((row) => (
              <tr key={row.routes}>
                <td className="mono">{row.routes}</td>
                <td className="mono">{row.vista}</td>
                <td className="mono">{row.accion}</td>
                <td className="mono">{row.portalFallback}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
