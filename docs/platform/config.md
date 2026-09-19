# Config and secrets: typed env, per-target `SecretStore`

Status: v1, 2026-09-19. Owner: app-shell (Forge); reviewed by Sentinel. Spec: PAP-17. Code:
`packages/core/src/config/` (subpath export `@paperos/core/config`), browser adapter
`apps/web/src/config.ts`. Consumed later by the kernel's config and secrets port (PAP-444), the
runtime-flags issue (`VITE_FLAGS` is bootstrap-only here) and server-side field encryption
(`APP_ENCRYPTION_KEY` is declared, not consumed, by this layer).

Every environment variable and client secret in PaperOS goes through this layer. No other package
reads `process.env` or `import.meta.env` directly — that boundary is what makes "which vars exist,
which target sees them, where a secret actually lives" answerable from one place instead of grepped
out of a dozen files, and it is what a client bundler (Vite) can enforce mechanically (§5).

## 1. Which variable goes where

| Schema | Prefix | Reaches | Consumed by |
| -- | -- | -- | -- |
| `publicEnvSchema` (`packages/core/src/config/schema.ts`) | `VITE_*` | Browser, desktop webview, mobile webview — anywhere the bundle ships | `apps/web`, `apps/desktop`'s webview, `apps/mobile`'s webview |
| `serverEnvSchema` | none (never `VITE_*`) | Server processes only: `apps/api`, migration jobs, CI | `apps/api`, `apps/desktop`'s Rust side (via `serverEnv`, not the webview) |

`publicEnvSchema`: `VITE_API_URL`, `VITE_APP_NAME`, `VITE_GIT_SHA`, `VITE_ELECTRIC_URL`,
`VITE_YJS_URL`, `VITE_SENTRY_DSN?`, `VITE_FLAGS?` (comma-separated flag names, bootstrap only — the
runtime flag service replaces it later). `serverEnvSchema`: `NODE_ENV`, `DATABASE_URL`,
`DATABASE_URL_MIGRATOR`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`,
`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `STRIPE_SECRET_KEY?`, `OTEL_EXPORTER_OTLP_ENDPOINT?`,
`APP_ENCRYPTION_KEY?`. An empty string (`KEY=`) counts as missing everywhere, same as an absent
key — a `.env` accident that leaves the `=` with nothing after it fails the same way a removed line
does.

`.env.example` is the single source of truth for "every key that exists": it carries a line for
every key above (empty for an optional one), plus `BASE_PATH` (a build input, not part of either
schema — PAP-13). `.env.test` is the fixed, committed set of values Vitest reads (§4). `.env.local`
is gitignored, per-developer, real values.

### 1.1 Extending the schema (other modules)

A module that needs its own env key — `DATABASE_URL_ELECTRIC` (data-layer, PAP-30 / PAP-42),
`OTEL_SERVICE_NAME` / `OTEL_TRACES_SAMPLER` / `OTEL_TRACES_SAMPLER_ARG` (data-layer, PAP-40), a
future `VITE_*` flag — never edits `schema.ts`. It registers an extension once, at import time,
from its own package:

```ts
import { registerServerEnvExtension } from '@paperos/core/config';
import { z } from 'zod';

registerServerEnvExtension('data-layer', z.object({
  DATABASE_URL_ELECTRIC: z.string().min(1),
}));
```

`loadConfig()` / `getServerEnv()` merge every registered extension with `.extend()` before parsing,
so a missing extension key fails boot named the same way a base key does (module + key, never the
value — `config/registry.ts`). `.env.example` and `.env.test` must carry the extension's keys too;
`pnpm --filter @paperos/core env:check` fails naming exactly which ones are missing.

## 2. Accessors

`@paperos/core/config` exports (Zod-inferred types `PublicEnv` / `ServerEnv`):

* `publicEnv: PublicEnv`, `serverEnv: ServerEnv` — live accessors; parse (and memoize) on first
  property read, not at import time, so importing this module never throws for a value nobody
  asked for yet.
* `getPublicEnv()`, `getServerEnv()` — the same parse-and-memoize, as a plain function call.
* `loadConfig(target, { includeServer? })` — validates for a target and returns
  `{ target, publicEnv, serverEnv? }`; `serverEnv` is included by default for every target except a
  real browser bundle (`web` running client-side).
* A failure throws `ConfigError`: `.message` and `.table` (`{ key, problem }[]`) name every failing
  key and Zod's problem for it — **never a value**, so it is safe to print, log, or paste into an
  issue.

## 3. `SecretStore`: one client-side secret port, four adapters

```ts
interface SecretStore {
  readonly target: Target; // 'web' | 'desktop' | 'ios' | 'android'
  get(name: string): Promise<string | undefined>;
  set(name: string, value: string): Promise<void>;
  delete(name: string): Promise<void>;
  list(): Promise<readonly string[]>;
}
getSecretStore(options?: { target?: Target }): SecretStore;
```

This is the **client-side** port — a locally-cached session token (PAP-57), never
`STRIPE_SECRET_KEY` and friends, which are `serverEnv` / the future credential broker (PAP-300,
wired by PAP-444). Every key is namespaced `paperos.<app>.<key>` (`namespacedKey` /
`namespacePrefix`, `config/secret-store.ts`) before it reaches real storage.

| Target | Adapter | Where the value actually lives | Status |
| -- | -- | -- | -- |
| `web` | `WebSecretStore` | An in-memory `Map`, for the tab's lifetime | Live |
| `desktop` | `TauriKeychainStore` | OS keychain (`keyring` crate) via Tauri commands | **Not wired yet** — apps/desktop is a stub (PAP-19); see `apps/desktop/README.md` for the exact Rust command contract this adapter already assumes |
| `ios` / `android` | `MobileSecureStore` | Keychain Services / Keystore-backed secure storage via a Tauri Mobile plugin | **Not wired yet** — apps/mobile is a stub (PAP-20); see `apps/mobile/README.md` |
| (Node/server, not a `Target`) | `EnvSecretStore` (`adapters/node.ts`) | `process.env`, masking-aware (`maskSecret`) | Live — the building block PAP-444's `EnvSecrets` adapter assembles |

`getTarget()` (`config/target.ts`) picks the target: no `window.__TAURI_INTERNALS__` → `web`;
present → `ios`/`android` by user agent, else `desktop`. Every "not wired yet" adapter throws a
specific, typed error naming the app and the tracking issue rather than silently no-op'ing — the
org standard for unfinished UI, applied to a port instead of a button.

**Never persisted, by design (web).** `WebSecretStore` never touches `localStorage` /
`sessionStorage`: a reload clears it. That is the whole point — it is the one thing standing
between "the user's session" and "an agent-written page that reads `localStorage`." Two windows
each get their own store (nothing to share, since nothing persists); "last write wins" and
`list()` being immediate both fall out of that for free.

**Android's 4 KB Keystore limit.** `MobileSecureStore.set()` on `android` rejects a value over
`MOBILE_SECRET_VALUE_LIMIT_BYTES` (4000 bytes) with a clear error before it ever reaches the
native bridge — never silent chunking. `ios` has no such limit.

**Headless Linux, no `secret-service`.** Not this package's problem to solve (there is no Rust
code here yet) but the contract `apps/desktop/README.md` fixes for PAP-19: the `keyring` crate's
encrypted-file fallback, with a loud, visible warning the first time it falls back — never a
silent downgrade.

## 4. How values are read (and why Vitest sees `.env.test`, never `.env.local`)

`config/env-source.ts` is deliberately split from `config/env-source.node.ts`:

* `env-source.ts` is pure — string parsing (`parseDotEnv`) and a registration slot
  (`setNodeEnvFileReader`). It has **zero** `node:fs` / `node:path` imports, on purpose: it is part
  of `@paperos/core/config`'s barrel, which a browser bundle imports.
* `env-source.node.ts` is the real, file-backed reader (`node:fs` / `node:path`) and registers
  itself as a side effect of being imported. Only Node-only entry points import it: the `env:check`
  CLI, and this package's own tests.

In a real browser, `isBrowserLike()` is true and `readPublicSource()` reads `import.meta.env`
directly — Vite has already inlined those values at build time, so `readNodeEnv()` (and therefore
`env-source.node.ts`) is never even reached. Everywhere else (Node scripts, the API process,
Vitest), `readNodeEnv()` asks the registered file reader for exactly one file, keyed by
`NODE_ENV`: `.env.test` when testing, `.env.local` otherwise — **never both, never the other one**.
Real `process.env` values always win over the file, so CI and shell exports still take precedence
over a checked-in or gitignored default.

## 5. The bundle guard

Two independent things keep a server-only value out of a client bundle:

1. **The schema boundary itself.** `apps/web/src/config.ts` only ever imports
   `getPublicEnv` / `getSecretStore` / `getTarget`; nothing there can reach `getServerEnv` or
   `serverEnv` by accident, because nothing in `publicEnvSchema`'s shape overlaps
   `serverEnvSchema`'s.
2. **`paperosEnvGuard()`** (`config/vite-plugin.ts`), a Vite `transform` hook that scans source
   text — before Vite's own `define` substitution — for `import.meta.env.<name>` where `<name>` is
   not `VITE_`-prefixed, or any `process.env.<name>` at all, and fails the build naming the file and
   the read. `packages/core/src/config/**` is exempt (that folder is where these reads are
   supposed to happen); everything else is not. Not yet registered in `apps/web/vite.config.ts` —
   see "Wiring apps/web" below.

A regression test (`packages/core/src/config/bundle-leak.test.ts`) runs a real Vite client build of
a fixture that imports only the public accessors and asserts none of `serverEnvSchema`'s key names
(`DATABASE_URL`, `BETTER_AUTH_SECRET`, ...) appear in the minified output. It found a real bug while
this issue was built: an unused top-level `export const x = z.object({...})` (or `new Proxy(...)`)
is *not* eliminated by Rollup's tree-shaking by default — a bundler cannot prove an arbitrary
function call has no side effects, so it keeps evaluating it even when nothing imports the result.
`schema.ts` and `load.ts` mark those specific calls `/* @__PURE__ */`, which — combined with the
minification every real `vite build` does by default — is what actually drops them. (Rollup's own,
unminified tree-shake pass still leaves an orphaned expression statement behind for a call whose
*arguments* contain further unannotated calls, like a Zod object literal calling `.string()` per
field; only the minifier's own dead-code pass removes that residue. The regression test builds with
minification on for exactly this reason — that is what ships.) Any future top-level, unused,
non-trivial value in this folder needs the same annotation and the same regression coverage, or it
will quietly widen the client bundle again.

## 6. Wiring `apps/web` (tracked follow-up, not done by PAP-17)

`apps/web/src/config.ts` exists and is fully tested, but is not yet imported by `main.tsx`, and
`apps/web/vite.config.ts` does not yet register `paperosEnvGuard()` or set `envDir` to the repo
root (where `.env.example` / `.env.test` live — Vite's default `envDir` is the config file's own
directory, `apps/web/`, which has no env files of its own). Landing this needs three small,
low-risk changes to `apps/web/vite.config.ts` / `vitest.config.ts` / `main.tsx` respectively; it
was left as a follow-up rather than raced against PAP-16's router work landing in the same window.
Until then, `apps/web`'s only real environment input remains `VITE_GIT_SHA` (via `vite.config.ts`'s
existing `define`, from PAP-13).

## 7. CI and Coolify

CI sets `VITE_GIT_SHA` from the checkout (already true, PAP-13) and runs
`pnpm --filter @paperos/core env:check` as a Gate 1 step against `.env.example`; a removed key
fails the table, not a mysterious downstream error. Coolify injects real values from sops-encrypted
files at deploy time (PAP-25/PAP-26); this layer does not know or care how a value arrived in
`process.env` / `import.meta.env`, only that it matches the schema once it is there.

## 8. Rotation

`SecretsPort.onRotate(name, cb)` (PAP-444) is the rotation hook for server-side secrets — this
layer only declares the names (`serverEnvSchema`) and reads the current value; it does not itself
rotate anything. `PAP-302`'s `CURSOR_SECRET` / `CURSOR_SECRET_PREVIOUS` pattern (dual-name,
old-then-new) is the model PAP-444 follows once it lands.
