import './components.css';

export default function ContentNav({ back, crumbs }) {
  if (!back && !crumbs?.length) return null;

  return (
    <nav className="content-nav" aria-label="Navegación">
      {back && (
        <button type="button" className="content-nav__back" onClick={back.onClick}>
          <span className="content-nav__back-icon" aria-hidden>
            ←
          </span>
          {back.label}
        </button>
      )}

      {crumbs?.length > 0 && (
        <ol className="content-nav__crumbs">
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            const current = crumb.current ?? isLast;

            return (
              <li key={`${crumb.label}-${i}`} className="content-nav__crumb">
                {i > 0 && (
                  <span className="content-nav__sep" aria-hidden>
                    /
                  </span>
                )}
                {crumb.onClick && !current ? (
                  <button type="button" className="content-nav__link" onClick={crumb.onClick}>
                    {crumb.label}
                  </button>
                ) : (
                  <span
                    className={`content-nav__text ${current ? 'is-current' : ''} ${crumb.mono ? 'mono' : ''}`}
                    aria-current={current ? 'page' : undefined}
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </nav>
  );
}
