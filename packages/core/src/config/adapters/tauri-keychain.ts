import type { SecretStore } from '../secret-store.js';

/**
 * Desktop `SecretStore`, backed by the OS keychain through Tauri.
 *
 * **Not wired yet.** The Rust side (`apps/desktop/src-tauri/src/commands/secrets.rs`,
 * the `secret_get` / `secret_set` / `secret_delete` / `secret_list` commands
 * built on the `keyring` crate) lands with PAP-19, which scaffolds
 * `apps/desktop` as a real Tauri project — today that folder is still the
 * stub described in `apps/desktop/README.md`. This class fixes the exact
 * shape the real adapter will have, so PAP-57's session-token code (and this
 * issue's own tests) can be written against it now, and fails loudly and
 * specifically — never silently — when the Tauri bridge it needs is absent.
 *
 * The plan for when it is wired (full detail in `apps/desktop/README.md`):
 * - `get` / `set` / `delete` call `invoke('secret_get' | 'secret_set' | 'secret_delete', { key })`,
 *   where `key` is the already-namespaced `paperos.<app>.<name>` string.
 * - `list` calls `invoke('secret_list')`, scoped server-side (Rust) to the
 *   calling app's namespace prefix, so one app can never enumerate another's keys.
 * - Linux without a running `secret-service` (headless CI, some window
 *   managers): the `keyring` crate falls back to an encrypted file under the
 *   app's config dir and logs a loud warning the first time it does. This
 *   adapter re-throws that warning verbatim (never swallows it) so the
 *   settings debug page can show it.
 */
export class TauriKeychainStore implements SecretStore {
  readonly target = 'desktop' as const;

  constructor(private readonly app = 'shell') {}

  async get(_name: string): Promise<string | undefined> {
    this.notWiredYet('secret_get');
  }

  async set(_name: string, _value: string): Promise<void> {
    this.notWiredYet('secret_set');
  }

  async delete(_name: string): Promise<void> {
    this.notWiredYet('secret_delete');
  }

  async list(): Promise<readonly string[]> {
    this.notWiredYet('secret_list');
  }

  private notWiredYet(command: string): never {
    throw new Error(
      `TauriKeychainStore(${this.app}).${command}: not wired yet — apps/desktop is still a ` +
        'stub (PAP-19). See apps/desktop/README.md for the Rust command contract this adapter ' +
        'will call once that lands.',
    );
  }
}
