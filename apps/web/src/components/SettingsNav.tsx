import { t } from '../i18n/t.js';

/**
 * The `sidebar` slot fill for `/settings` (spec: `components[].slot:
 * sidebar`, `id: app.settingsNav`). Marked `status: not-wired` in the spec —
 * see `DashboardFilters.tsx`.
 */
export function SettingsNav() {
  return (
    <div className="paperos-panel">
      <h2>{t('settings.sidebar.title')}</h2>
      <p>{t('settings.sidebar.body')}</p>
    </div>
  );
}
