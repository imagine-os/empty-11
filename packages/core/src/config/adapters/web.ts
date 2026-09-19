import type { SecretStore } from '../secret-store.js';
import { namespacedKey, namespacePrefix } from '../secret-store.js';

/**
 * Browser secret store. **Never persisted** — the spec is explicit that a
 * client-side secret in a browser must not survive a reload, because a
 * reload is the only thing standing between "the user's session" and "an
 * agent-written page that reads `localStorage`". Everything lives in a
 * `Map` for the lifetime of the tab.
 *
 * Consequences, both documented in the edge cases:
 * - Each tab/window has its own store (nothing to persist means nothing to
 *   share across tabs either); "last write wins" is trivially true because
 *   there is only ever one writer per store instance.
 * - `list()` is immediate: it is an in-memory `Map`, there is no I/O to wait on.
 */
export class WebSecretStore implements SecretStore {
  readonly target = 'web' as const;
  private readonly app: string;
  private readonly values = new Map<string, string>();

  constructor(app = 'shell') {
    this.app = app;
  }

  async get(name: string): Promise<string | undefined> {
    return this.values.get(namespacedKey(this.app, name));
  }

  async set(name: string, value: string): Promise<void> {
    this.values.set(namespacedKey(this.app, name), value);
  }

  async delete(name: string): Promise<void> {
    this.values.delete(namespacedKey(this.app, name));
  }

  async list(): Promise<readonly string[]> {
    const prefix = namespacePrefix(this.app);
    return [...this.values.keys()]
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length));
  }
}
