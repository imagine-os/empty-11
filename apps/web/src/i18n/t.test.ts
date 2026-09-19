import { afterEach, describe, expect, it } from 'vitest';
import { getLocale, setLocale, t } from './t.js';

describe('t()', () => {
  afterEach(() => {
    setLocale('en');
  });

  it('looks up a plain key in English by default', () => {
    expect(t('home.title')).toBe('PaperOS template');
  });

  it('interpolates {{placeholder}} variables', () => {
    expect(t('dashboard.body', { spec: 'dashboard' })).toContain('dashboard');
  });

  it('switches catalogs when the locale changes', () => {
    setLocale('es');
    expect(getLocale()).toBe('es');
    expect(t('home.title')).toBe('Plantilla PaperOS');
  });

  it('falls back to the key itself for an unknown key', () => {
    // @ts-expect-error deliberately an invalid key, to check the runtime fallback
    expect(t('nope.nope')).toBe('nope.nope');
  });
});
