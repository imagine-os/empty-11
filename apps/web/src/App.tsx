import { TEMPLATE_TITLE } from '@paperos/ui';

/**
 * Placeholder route. PAP-16 replaces it with the router and the real shell.
 *
 * It renders exactly two values: the title (owned by `@paperos/ui`, so it is not
 * hard-coded here) and the build's commit SHA. No other user-visible string
 * exists, which keeps the page translatable the day the i18n catalog lands.
 */
export function App() {
  const gitSha = import.meta.env.VITE_GIT_SHA;

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">{TEMPLATE_TITLE}</h1>
      </header>
      <main className="page__main">
        <output className="page__sha">{gitSha}</output>
      </main>
    </div>
  );
}
