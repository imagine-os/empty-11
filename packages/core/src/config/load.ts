import type { z } from 'zod';
import { isBrowserLike, readNodeEnv } from './env-source.js';
import { extendedPublicEnvSchema, extendedServerEnvSchema } from './registry.js';
import type { PublicEnv, ServerEnv } from './schema.js';

/**
 * Thrown by `publicEnv` / `serverEnv` / `loadConfig()` on a validation
 * failure. `.table` never contains a value — only key names and the Zod
 * message — so it is safe to print, log or paste into a bug report.
 */
export class ConfigError extends Error {
  readonly table: ReadonlyArray<{ key: string; problem: string }>;

  constructor(kind: 'public' | 'server', issues: z.core.$ZodIssue[]) {
    const table = issues.map((issue) => ({
      key: issue.path.join('.') || '(root)',
      problem: issue.message,
    }));
    const lines = table.map((row) => `  ${row.key}: ${row.problem}`).join('\n');
    super(`invalid ${kind} config — fix these keys (values are never logged):\n${lines}`);
    this.name = 'ConfigError';
    this.table = table;
  }
}

/**
 * Raw source for the public (`VITE_*`) schema: `import.meta.env` in a real
 * browser bundle (Vite has already inlined it), the Node dotenv reader
 * everywhere else (scripts, the API process, Vitest).
 */
function readPublicSource(): Record<string, string | undefined> {
  if (isBrowserLike()) {
    // Vite statically replaces `import.meta.env.VITE_*`; nothing else survives
    // the build (packages/core/src/config/vite-plugin.ts enforces that), so
    // reading the whole object here is safe. Cast through `unknown`, not the
    // ambient `ImportMetaEnv`, because this package (unlike `apps/web`) does
    // not reference `vite/client` — it must not assume a bundler is present.
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    return meta.env ?? {};
  }
  return readNodeEnv();
}

/** Raw source for the server-only schema: Node only, real `process.env` merged over the mode file. */
function readServerSource(): Record<string, string | undefined> {
  return readNodeEnv();
}

function parseOrThrow<T>(
  kind: 'public' | 'server',
  schema: z.ZodType<T>,
  source: Record<string, string | undefined>,
): T {
  const result = schema.safeParse(source);
  if (!result.success) throw new ConfigError(kind, result.error.issues);
  return result.data;
}

let cachedPublicEnv: PublicEnv | undefined;
let cachedServerEnv: ServerEnv | undefined;

/**
 * Parses (and memoizes) the public config. Parsing happens on first access,
 * not at import time, so importing this module in a context that has no
 * public env yet (a pure server script, a test that only wants `getTarget()`)
 * never throws for values nobody asked for.
 */
export function getPublicEnv(): PublicEnv {
  if (!cachedPublicEnv) {
    cachedPublicEnv = parseOrThrow(
      'public',
      extendedPublicEnvSchema(),
      readPublicSource(),
    ) as PublicEnv;
  }
  return cachedPublicEnv;
}

/**
 * Parses (and memoizes) the server-only config. Never call this from code
 * that ships to a browser, desktop-webview or mobile-webview bundle — the
 * leak-guard Vite plugin fails the build if you try.
 */
export function getServerEnv(): ServerEnv {
  if (!cachedServerEnv) {
    cachedServerEnv = parseOrThrow(
      'server',
      extendedServerEnvSchema(),
      readServerSource(),
    ) as ServerEnv;
  }
  return cachedServerEnv;
}

/**
 * Live accessor for the public config; parses once, on first property read.
 *
 * `/* @__PURE__ *\/` on the `new Proxy(...)` call matters here, not just
 * style: without it, Rollup/esbuild cannot prove this top-level initializer
 * has no side effects and keeps it (and, by the same reasoning, `serverEnv`
 * below) in *any* bundle that uses anything else from this file — which is
 * exactly how `DATABASE_URL` and the other server-only key names ended up in
 * a client bundle that only ever calls `getPublicEnv()`, the leak this
 * layer exists to prevent. Annotated, an unused `publicEnv` / `serverEnv`
 * genuinely drops out.
 */
export const publicEnv: PublicEnv = /* @__PURE__ */ new Proxy({} as PublicEnv, {
  get: (_target, prop) => Reflect.get(getPublicEnv() as object, prop),
  has: (_target, prop) => Reflect.has(getPublicEnv() as object, prop),
  ownKeys: () => Reflect.ownKeys(getPublicEnv() as object),
  getOwnPropertyDescriptor: (_target, prop) =>
    Reflect.getOwnPropertyDescriptor(getPublicEnv() as object, prop),
});

/** Live accessor for the server config; parses once, on first property read. See `publicEnv`'s doc comment for why `/* @__PURE__ *\/` is load-bearing. */
export const serverEnv: ServerEnv = /* @__PURE__ */ new Proxy({} as ServerEnv, {
  get: (_target, prop) => Reflect.get(getServerEnv() as object, prop),
  has: (_target, prop) => Reflect.has(getServerEnv() as object, prop),
  ownKeys: () => Reflect.ownKeys(getServerEnv() as object),
  getOwnPropertyDescriptor: (_target, prop) =>
    Reflect.getOwnPropertyDescriptor(getServerEnv() as object, prop),
});

/** Result of `loadConfig()`: which env(s) were validated for this target. */
export interface LoadedConfig {
  readonly target: import('./target.js').Target;
  readonly publicEnv: PublicEnv;
  /** Absent on `web`/`ios`/`android`: those targets never see server config. */
  readonly serverEnv?: ServerEnv;
}

/**
 * Validates config for `target` and fails fast. Every target validates the
 * public schema (it is what the shell itself needs — API URL, app name, ...);
 * only a target that can legitimately hold server secrets (`desktop`, or
 * `web` running as the Node dev/build/API process, never a browser bundle)
 * also validates the server schema.
 *
 * Throws `ConfigError` — a table of key names and problems, never values —
 * on the first call that needs a key that fails to parse.
 */
export function loadConfig(
  target: import('./target.js').Target,
  options: { includeServer?: boolean } = {},
): LoadedConfig {
  const includeServer = options.includeServer ?? (target === 'desktop' || !isBrowserLike());
  const loaded: LoadedConfig = {
    target,
    publicEnv: getPublicEnv(),
    ...(includeServer ? { serverEnv: getServerEnv() } : {}),
  };
  return loaded;
}

/** Test-only: forget the memoized singletons so a suite can re-parse with different env. */
export function resetLoadedConfig(): void {
  cachedPublicEnv = undefined;
  cachedServerEnv = undefined;
}
