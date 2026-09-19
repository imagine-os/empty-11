/**
 * Dev-mode flag (org standard): `?dev=1` in the URL or `localStorage['paperos:dev']`.
 * Drives the "not wired yet" marking on placeholder UI (org standard,
 * CLAUDE.md "Placeholders are marked").
 */
const STORAGE_KEY = 'paperos:dev';

export function isDevMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('dev') === '1') {
      window.localStorage.setItem(STORAGE_KEY, '1');
      return true;
    }
    if (params.get('dev') === '0') {
      window.localStorage.removeItem(STORAGE_KEY);
      return false;
    }
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // Storage disabled (private browsing, kiosk lockdown): fall back to the query string only.
    return new URLSearchParams(window.location.search).get('dev') === '1';
  }
}
