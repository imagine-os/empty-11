import { MobileSecureStore } from './adapters/mobile-secure-storage.js';
import { TauriKeychainStore } from './adapters/tauri-keychain.js';
import { WebSecretStore } from './adapters/web.js';
import type { SecretStore } from './secret-store.js';
import type { Target } from './target.js';
import { getTarget } from './target.js';

export type { SecretStore } from './secret-store.js';
export { namespacedKey, namespacePrefix, stripNamespace } from './secret-store.js';

export interface SecretStoreOptions {
  /** Overrides target detection; tests pass this instead of faking globals twice. */
  target?: Target;
}

/**
 * Picks the right adapter for the current target. Desktop and mobile adapters
 * are stubs today (`docs/platform/config.md` "Not wired yet" table): they
 * implement the same interface and throw a clear, typed error until PAP-19 /
 * PAP-20 mount the native side.
 */
export function getSecretStore(options: SecretStoreOptions = {}): SecretStore {
  const target = options.target ?? getTarget();
  switch (target) {
    case 'web':
      return new WebSecretStore();
    case 'desktop':
      return new TauriKeychainStore();
    case 'ios':
    case 'android':
      return new MobileSecureStore(target);
  }
}
