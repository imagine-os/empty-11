import { t } from '../i18n/t.js';

/**
 * The `sidebar` slot fill for `/dashboard` (spec: `components[].slot: sidebar`,
 * `id: app.dashboardFilters`). Marked `status: not-wired` in the spec, so
 * `useSpecLayout` wraps it in the "not wired yet" treatment automatically —
 * this component itself renders only its content.
 */
export function DashboardFilters() {
  return (
    <div className="paperos-panel">
      <h2>{t('dashboard.sidebar.title')}</h2>
      <p>{t('dashboard.sidebar.body')}</p>
    </div>
  );
}
