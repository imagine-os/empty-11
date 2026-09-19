/**
 * Example route #2 (authenticated dashboard, `/dashboard`). Spec:
 * `specs/pages/dashboard.spec.yaml` — `useSpecLayout` fills `nav`, `sidebar`
 * and `inspector` from `components[].slot` and registers `logic.actions`
 * (here, `refresh`, `status: not-wired`) onto the actions registry.
 * `?inspector=open` (demo) reveals the inspector.
 */

import { useSpec, useSpecLayout } from '@paperos/core/shell';
import type { PageSpec } from '@paperos/spec';
import { createFileRoute } from '@tanstack/react-router';
import dashboardSpec from '../../../../../specs/pages/dashboard.spec.yaml';
import { t } from '../../i18n/t.js';

export const Route = createFileRoute('/_app/dashboard')({
  component: DashboardRoute,
  staticData: {
    spec: dashboardSpec.meta.id,
    title: 'dashboard.title',
    audience: dashboardSpec.meta.surface,
  },
});

function DashboardRoute() {
  useSpecLayout(dashboardSpec);
  const spec = useSpec<PageSpec>('dashboard');

  return (
    <div className="page">
      <h1 className="page__title">{t('dashboard.title')}</h1>
      <p>{t('dashboard.body', { spec: spec?.meta.id ?? 'dashboard' })}</p>
    </div>
  );
}
