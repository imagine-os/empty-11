import type { SecretStore } from '../secret-store.js';
import type { Target } from '../target.js';

/** Android Keystore values are capped around 4 KB; a value over that limit is refused, not silently chunked. */
export const MOBILE_SECRET_VALUE_LIMIT_BYTES = 4000;

/**
 * iOS / Android `SecretStore`, backed by the platform's secure storage
 * through a Tauri Mobile plugin (Keychain Services on iOS, the Keystore-backed
 * `EncryptedSharedPreferences` on Android).
 *
 * **Not wired yet.** `apps/mobile` is still the stub in `apps/mobile/README.md`
 * (PAP-20 scaffolds the real Tauri Mobile project). This class fixes the
 * contract — including the one behaviour that differs from desktop, the
 * Android value-size limit — so it can be built against and tested before the
 * native plugin exists.
 *
 * Plan for when it is wired:
 * - Same `secret_get` / `secret_set` / `secret_delete` / `secret_list` command
 *   names as desktop (`TauriKeychainStore`) — the port is identical, only the
 *   Rust command's implementation differs by platform (`keyring` crate vs. the
 *   mobile secure-storage plugin), per `docs/module-system.md` §4's config row:
 *   "the port is the same, the adapter differs by target."
 * - Edge case (spec): a value over ~4 KB on Android Keystore is **rejected
 *   with a clear error**, never silently chunked — `set()` checks the byte
 *   length up front so the failure happens on this side of the bridge, with
 *   the offending name in the message, not as an opaque native error.
 */
export class MobileSecureStore implements SecretStore {
  readonly target: Target;

  constructor(
    target: Extract<Target, 'ios' | 'android'>,
    private readonly app = 'shell',
  ) {
    this.target = target;
  }

  async get(_name: string): Promise<string | undefined> {
    this.notWiredYet('secret_get');
  }

  async set(name: string, value: string): Promise<void> {
    const bytes = new TextEncoder().encode(value).length;
    if (this.target === 'android' && bytes > MOBILE_SECRET_VALUE_LIMIT_BYTES) {
      throw new Error(
        `MobileSecureStore.set: "${name}" is ${bytes} bytes, over the ${MOBILE_SECRET_VALUE_LIMIT_BYTES}-byte ` +
          'Android Keystore limit. Store a reference (e.g. in serverEnv-backed storage) instead of the raw value.',
      );
    }
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
      `MobileSecureStore(${this.target}/${this.app}).${command}: not wired yet — apps/mobile is ` +
        'still a stub (PAP-20). See apps/mobile/README.md for the secure-storage plugin contract ' +
        'this adapter will call once that lands.',
    );
  }
}
