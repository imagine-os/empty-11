/**
 * Server/Node secret reading, factored out of `serverEnv` so PAP-444's
 * `EnvSecrets` adapter (`docs/module-system.md` §4, "Config and secrets
 * port": "Adapters: `EnvSecrets` (PAP-17 per-target storage: env, keychain,
 * secure storage)") has a ready building block instead of re-deriving one.
 *
 * This is not the client-facing `SecretStore` port (`../secret-store.js`) —
 * there is no OS keychain on a server, so there is nothing to namespace or
 * persist beyond the process environment itself. It is a thin, masking-aware
 * reader over a plain env-shaped object, defaulting to `process.env` (a read
 * allowed here because this file lives in `packages/core/src/config/` —
 * PAP-444's lint rule R12 only forbids `process.env` outside this folder and
 * its adapters).
 */
export class EnvSecretStore {
  constructor(private readonly source: Record<string, string | undefined> = process.env) {}

  /** Present and non-empty; an empty string counts as absent, same rule as the config schemas. */
  has(name: string): boolean {
    const value = this.source[name];
    return value !== undefined && value !== '';
  }

  /** The raw value, or `undefined` if unset or empty. Never logs or masks — callers choose that. */
  get(name: string): string | undefined {
    const value = this.source[name];
    return value === '' ? undefined : value;
  }

  /** Which of `names` are actually set, for a "what's configured" report — never the values. */
  list(names: readonly string[]): readonly string[] {
    return names.filter((name) => this.has(name));
  }
}

/**
 * `sk_live_51H...9f2c` → `****************9f2c`: keeps enough to recognise
 * *which* secret is loaded without exposing it. Used by the (planned)
 * `paperos module config` CLI and the settings debug page.
 */
export function maskSecret(value: string): string {
  const visible = 4;
  if (value.length <= visible) return '*'.repeat(value.length);
  return `${'*'.repeat(value.length - visible)}${value.slice(-visible)}`;
}
