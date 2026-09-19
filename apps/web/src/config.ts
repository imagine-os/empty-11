/**
 * Browser-side entry point into the typed config layer
 * (`@paperos/core/config`, PAP-17). Nothing else under `apps/web/src/**`
 * should read `import.meta.env` directly — route through `getWebConfig()`
 * here instead, so the `VITE_*` allowlist (`publicEnvSchema`) is enforced in
 * exactly one place in this app.
 *
 * Deliberately lazy: `getWebConfig()` only parses `import.meta.env` the
 * first time something calls it, not when this module is imported, so
 * importing it is always safe (a test file, a page that does not need
 * config yet) even before every `VITE_*` key is set.
 *
 * Not wired into app boot yet — `main.tsx` still runs without it, and
 * `vite.config.ts` does not yet register the leak-guard plugin
 * (`paperosEnvGuard`, also from `@paperos/core/config`) or point `envDir` at
 * the repo root, where `.env.example` / `.env.test` live. That three-line
 * wiring is tracked as a PAP-17 follow-up so it lands alongside PAP-16's
 * router work instead of racing it; see `docs/platform/config.md`.
 */
import type { PublicEnv, SecretStore, Target } from '@paperos/core/config';
import { getPublicEnv, getSecretStore, getTarget } from '@paperos/core/config';

/** The client target this tab/window is running as (always `'web'` outside a Tauri webview). */
export const target: Target = getTarget();

/** Validated `VITE_*` config. Throws `ConfigError` — key names only, never a value — if one is missing or empty. */
export function getWebConfig(): PublicEnv {
  return getPublicEnv();
}

/** This tab's client-side secret store (in-memory, never persisted, on `web`). */
export function getWebSecretStore(): SecretStore {
  return getSecretStore({ target });
}
