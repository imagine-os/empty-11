import { describe, expect, it } from 'vitest';
import { getTarget } from './target.js';

describe('getTarget', () => {
  it('is web with no window at all (SSR / Node)', () => {
    expect(getTarget({})).toBe('web');
  });

  it('is web when window exists but Tauri never injected __TAURI_INTERNALS__', () => {
    expect(getTarget({ window: {}, navigator: { userAgent: 'Mozilla/5.0 (Macintosh)' } })).toBe(
      'web',
    );
  });

  it('is desktop when Tauri is present and the UA names a desktop OS', () => {
    expect(
      getTarget({
        window: { __TAURI_INTERNALS__: {} },
        navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      }),
    ).toBe('desktop');
  });

  it('is ios when Tauri is present and the UA names an Apple mobile device', () => {
    expect(
      getTarget({
        window: { __TAURI_INTERNALS__: {} },
        navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)' },
      }),
    ).toBe('ios');
  });

  it('is android when Tauri is present and the UA names Android', () => {
    expect(
      getTarget({
        window: { __TAURI_INTERNALS__: {} },
        navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 15)' },
      }),
    ).toBe('android');
  });

  it('a plain mobile browser (no Tauri) is still web, never ios/android', () => {
    expect(
      getTarget({
        window: {},
        navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)' },
      }),
    ).toBe('web');
  });

  it('defaults to reading globalThis when called with no scope', () => {
    // The test environment is Node: no window, so this must resolve to web.
    expect(getTarget()).toBe('web');
  });
});
