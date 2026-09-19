import { t } from '../i18n/t.js';

/**
 * The `inspector` slot fill for `/dashboard` (spec: `components[].slot:
 * inspector`, `id: app.dashboardInspector`), opened via `?inspector=open`.
 * Marked `status: not-wired` in the spec — see `DashboardFilters.tsx`.
 */
export function DashboardInspector() {
  return (
    <div className="paperos-panel">
      <h2>{t('dashboard.inspector.title')}</h2>
      <p>{t('dashboard.inspector.body')}</p>
    </div>
  );
}
