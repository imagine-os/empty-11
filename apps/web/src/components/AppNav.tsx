import { Link } from '@tanstack/react-router';
import { t } from '../i18n/t.js';

/**
 * The `nav` slot fill every example page shares (registered once, filled via
 * each page's spec `layout.slots.nav: AppNav` — see `specs/pages/*.spec.yaml`).
 */
export function AppNav() {
  return (
    <nav aria-label={t('shell.nav.home')} className="paperos-app-nav">
      <Link to="/" activeOptions={{ exact: true }} activeProps={{ 'aria-current': 'page' }}>
        {t('shell.nav.home')}
      </Link>
      <Link to="/dashboard" activeProps={{ 'aria-current': 'page' }}>
        {t('shell.nav.dashboard')}
      </Link>
      <Link to="/settings" activeProps={{ 'aria-current': 'page' }}>
        {t('shell.nav.settings')}
      </Link>
    </nav>
  );
}
