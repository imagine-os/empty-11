/**
 * Example route #3 (authenticated, nested, `/settings`). Spec:
 * `specs/pages/settings.spec.yaml`. Nested under `_app` — proves "nested
 * layouts under `_app/settings/*` never double-render nav" (edge case),
 * since `<AppShell>` (and its single `nav` slot) is only ever rendered once,
 * at `__root.tsx`.
 */

import { useSpec, useSpecLayout } from '@paperos/core/shell';
import type { PageSpec } from '@paperos/spec';
import { createFileRoute } from '@tanstack/react-router';
import settingsSpec from '../../../../../../specs/pages/settings.spec.yaml';
import { t } from '../../../i18n/t.js';

export const Route = createFileRoute('/_app/settings/')({
  component: SettingsRoute,
  staticData: {
    spec: settingsSpec.meta.id,
    title: 'settings.title',
    audience: settingsSpec.meta.surface,
  },
});

function SettingsRoute() {
  useSpecLayout(settingsSpec);
  const spec = useSpec<PageSpec>('settings');

  return (
    <div className="page">
      <h1 className="page__title">{t('settings.title')}</h1>
      <p>{t('settings.body', { spec: spec?.meta.id ?? 'settings' })}</p>
    </div>
  );
}
