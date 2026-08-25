import './components.css';

export default function ThemeToggle({ theme, onToggle }) {
  return (
    <button type="button" className="theme-toggle" onClick={onToggle} aria-label="Toggle theme">
      {theme === 'dark' ? (
        <>
          <span className="theme-toggle__icon" aria-hidden>☀</span>
          Light
        </>
      ) : (
        <>
          <span className="theme-toggle__icon" aria-hidden>☾</span>
          Dark
        </>
      )}
    </button>
  );
}
