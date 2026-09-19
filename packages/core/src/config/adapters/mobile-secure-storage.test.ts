import { describe, expect, it } from 'vitest';
import { MOBILE_SECRET_VALUE_LIMIT_BYTES, MobileSecureStore } from './mobile-secure-storage.js';

describe('MobileSecureStore (not wired yet)', () => {
  it('reports the target it was constructed with', () => {
    expect(new MobileSecureStore('ios').target).toBe('ios');
    expect(new MobileSecureStore('android').target).toBe('android');
  });

  it('get/delete/list throw a clear "not wired yet" error naming apps/mobile and PAP-20', async () => {
    const store = new MobileSecureStore('ios');
    await expect(store.get('token')).rejects.toThrow(/not wired yet.*PAP-20/s);
    await expect(store.delete('token')).rejects.toThrow(/not wired yet.*PAP-20/s);
    await expect(store.list()).rejects.toThrow(/not wired yet.*PAP-20/s);
  });

  it('set() on iOS is also not wired yet (no size limit there)', async () => {
    const store = new MobileSecureStore('ios');
    await expect(store.set('token', 'x'.repeat(10))).rejects.toThrow(/not wired yet/);
  });

  it('set() on Android rejects an over-limit value before it ever reaches the (unwired) bridge', async () => {
    const store = new MobileSecureStore('android');
    const tooBig = 'x'.repeat(MOBILE_SECRET_VALUE_LIMIT_BYTES + 1);
    await expect(store.set('big-token', tooBig)).rejects.toThrow(
      /4000-byte Android Keystore limit/,
    );
  });

  it('set() on Android at or under the limit falls through to "not wired yet", not the size error', async () => {
    const store = new MobileSecureStore('android');
    const okSize = 'x'.repeat(MOBILE_SECRET_VALUE_LIMIT_BYTES);
    await expect(store.set('ok-token', okSize)).rejects.toThrow(/not wired yet/);
  });
});
