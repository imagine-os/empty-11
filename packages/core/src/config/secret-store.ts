import type { Target } from './target.js';

/**
 * A client-side secret store. Every target gets one, and every one namespaces
 * its keys `paperos.<app>.<key>` so two apps sharing a device (or a keychain,
 * which is per-user, not per-app) never collide.
 *
 * This is the client-side port (browser session memory, OS keychain, mobile
 * secure storage) for things like a locally-cached session token. It is not
 * the server-side secrets port (`STRIPE_SECRET_KEY` and friends come from
 * `serverEnv` / the future credential broker, PAP-444) and it is not a
 * general key-value store — `list()` returns names only, `get()` is the only
 * way to read a value back.
 *
 * Lives in its own file, separate from `getSecretStore()` in `secrets.ts`, so
 * every adapter can depend on the port without an import cycle back through
 * the dispatcher that constructs adapters (Biome's `noImportCycles` is an
 * error in this repo's preset).
 */
export interface SecretStore {
  readonly target: Target;
  get(name: string): Promise<string | undefined>;
  set(name: string, value: string): Promise<void>;
  delete(name: string): Promise<void>;
  list(): Promise<readonly string[]>;
}

/** `paperos.<app>.` — every namespaced key for `app` starts with this. */
export function namespacePrefix(app: string): string {
  if (app === '') throw new Error('namespacePrefix: app must be non-empty');
  return `paperos.${app}.`;
}

/** `paperos.<app>.<key>` — the one namespacing rule every adapter applies before touching real storage. */
export function namespacedKey(app: string, name: string): string {
  if (name === '') throw new Error('namespacedKey: name must be non-empty');
  return `${namespacePrefix(app)}${name}`;
}

/** Strips the `paperos.<app>.` prefix back off, or returns `undefined` if it does not match `app`. */
export function stripNamespace(app: string, key: string): string | undefined {
  const prefix = namespacePrefix(app);
  return key.startsWith(prefix) ? key.slice(prefix.length) : undefined;
}
