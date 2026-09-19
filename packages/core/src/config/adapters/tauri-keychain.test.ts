import { describe, expect, it } from 'vitest';
import { TauriKeychainStore } from './tauri-keychain.js';

describe('TauriKeychainStore (not wired yet)', () => {
  it('reports the desktop target', () => {
    expect(new TauriKeychainStore().target).toBe('desktop');
  });

  it('every method throws a clear "not wired yet" error naming apps/desktop and PAP-19', async () => {
    const store = new TauriKeychainStore();
    await expect(store.get('token')).rejects.toThrow(/not wired yet.*PAP-19/s);
    await expect(store.set('token', 'value')).rejects.toThrow(/not wired yet.*PAP-19/s);
    await expect(store.delete('token')).rejects.toThrow(/not wired yet.*PAP-19/s);
    await expect(store.list()).rejects.toThrow(/not wired yet.*PAP-19/s);
  });
});
