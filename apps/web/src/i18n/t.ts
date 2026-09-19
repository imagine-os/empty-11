/**
 * Tiny message-catalog helper (org standard: "no hard-coded user-visible
 * strings"). A full catalog / ICU pipeline lands with PAP-27; until then
 * this is enough to keep every page's text out of JSX literals and behind a
 * key, with `{{placeholder}}` interpolation and an EN/ES pair.
 */
import en from './en.json';
import es from './es.json';

export type Locale = 'en' | 'es';
export type MessageKey = keyof typeof en;

const catalogs: Record<Locale, Record<string, string>> = { en, es };

const STORAGE_KEY = 'paperos:locale';
const DEFAULT_LOCALE: Locale = 'en';

export function getLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'es') return stored;
  } catch {
    // Storage disabled: fall through to browser language detection.
  }
  const lang = window.navigator?.language?.slice(0, 2);
  return lang === 'es' ? 'es' : DEFAULT_LOCALE;
}

export function setLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Storage disabled (private browsing, kiosk lockdown): locale reverts to detection on reload.
  }
}

/** `t('dashboard.body', { spec: 'dashboard' })` → catalog lookup + `{{placeholder}}` interpolation. */
export function t(key: MessageKey, vars?: Record<string, string>): string {
  const locale = getLocale();
  const template = catalogs[locale][key] ?? catalogs[DEFAULT_LOCALE][key] ?? key;
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => vars[name] ?? '');
}
