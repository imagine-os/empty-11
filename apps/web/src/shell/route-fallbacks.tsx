/**
 * Shared not-found / error / pending route components (Definition of done:
 * "Not-found, error boundary and pending routes"; Test plan: "route throwing
 * in a loader renders the error boundary with a retry button").
 */
import { type ErrorComponentProps, Link } from '@tanstack/react-router';
import { t } from '../i18n/t.js';

export function NotFoundRoute() {
  return (
    <div className="paperos-route-fallback" role="alert">
      <h1>{t('notFound.title')}</h1>
      <p>{t('notFound.body')}</p>
      <Link to="/">{t('notFound.cta')}</Link>
    </div>
  );
}

export function ErrorRoute({ error, reset }: ErrorComponentProps) {
  return (
    <div className="paperos-route-fallback" role="alert">
      <h1>{t('error.title')}</h1>
      <p>{t('error.body')}</p>
      <pre className="paperos-error-detail">
        {error instanceof Error ? error.message : String(error)}
      </pre>
      <button type="button" onClick={() => reset()}>
        {t('error.retry')}
      </button>
    </div>
  );
}

export function PendingRoute() {
  return (
    <div className="paperos-route-fallback" role="status" aria-live="polite">
      …
    </div>
  );
}
