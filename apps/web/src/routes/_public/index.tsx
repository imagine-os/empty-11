/**
 * Example route #1 (public home, `/`). Convention: the route file path
 * mirrors `specs/pages/<name>.spec.yaml` — this route's spec is
 * `specs/pages/home.spec.yaml`.
 */
import { useSpecLayout } from '@paperos/core/shell';
import { createFileRoute, Link } from '@tanstack/react-router';
import homeSpec from '../../../../../specs/pages/home.spec.yaml';
import { t } from '../../i18n/t.js';

export const Route = createFileRoute('/_public/')({
  component: HomeRoute,
  staticData: { spec: homeSpec.meta.id, title: 'home.title', audience: homeSpec.meta.surface },
});

function HomeRoute() {
  useSpecLayout(homeSpec);
  return (
    <div className="page">
      <h1 className="page__title">{t('home.title')}</h1>
      <p>{t('home.tagline')}</p>
      <Link to="/dashboard" className="page__cta">
        {t('home.cta.dashboard')}
      </Link>
    </div>
  );
}
