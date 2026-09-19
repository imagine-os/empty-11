import { afterEach, describe, expect, it, vi } from 'vitest';
import { getWebConfig, getWebSecretStore, target } from './config.js';

describe('apps/web config entry point', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('reports the web target in a jsdom (no Tauri) test environment', () => {
    expect(target).toBe('web');
  });

  it('hands back a client-side SecretStore for this target', async () => {
    const store = getWebSecretStore();
    expect(store.target).toBe('web');
    await store.set('probe', 'value');
    expect(await store.get('probe')).toBe('value');
  });

  it('getWebConfig() is lazy and only reads config on first call', () => {
    // Not wired into vite.config.ts's envDir yet (see config.ts's doc
    // comment), so apps/web's test environment only ever sees VITE_GIT_SHA
    // (set explicitly by vitest.config.ts's `define`) — every other
    // required VITE_* key is genuinely absent here today, and this asserts
    // that absence surfaces as a ConfigError naming the keys, not a crash
    // or a silently-empty object.
    vi.stubEnv('VITE_API_URL', '');
    expect(() => getWebConfig()).toThrow(/VITE_API_URL/);
  });
});
