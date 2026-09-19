/**
 * Where raw env values come from before Zod ever sees them.
 *
 * This file must stay importable from a browser bundle — `@paperos/core/config`
 * is the whole point of the `apps/web/src/config.ts` adapter — so it never
 * imports `node:fs` / `node:path` itself, even though "read the file for the
 * current `NODE_ENV`" is fundamentally a filesystem operation. The real,
 * file-backed reader lives in `env-source.node.ts` and self-registers with
 * `setNodeEnvFileReader()` the moment something imports it; a Node-only entry
 * point does that (the `env:check` CLI, this package's own tests), a browser
 * bundle never does (it only ever imports this file), so `readNodeEnv()` here
 * degrades to "just `process.env`, no file" rather than pulling in `node:fs`.
 *
 * In a real browser build the answer is simpler still: Vite statically
 * replaces `import.meta.env.VITE_*` at build time, so by the time this module
 * runs in a bundle those values are already inlined constants (see
 * `packages/core/src/config/vite-plugin.ts`, which fails the build if a
 * non-`VITE_` name is read at all) — `readNodeEnv()` is never even called
 * there (`isBrowserLike()` gates every call site in `load.ts`).
 */

/** A bare-bones `KEY=VALUE` parser: comments, blank lines, single/double-quoted values. */
export function parseDotEnv(contents: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    const quoted = /^(['"])(.*)\1$/.exec(value);
    if (quoted) value = quoted[2] ?? '';
    result[key] = value;
  }
  return result;
}

/**
 * `.env.test` for the test mode, `.env.local` for every other mode — never
 * both, never `.env` or `.env.[mode].local`. The spec's edge case is
 * explicit: "Vitest reads `.env.test` only, never `.env.local`." One
 * deterministic file beats a merge order nobody can recite from memory.
 */
export function envFileNameForMode(mode: string): '.env.test' | '.env.local' {
  return mode === 'test' ? '.env.test' : '.env.local';
}

/** What `readNodeEnv()` calls to get a mode's file contents; `env-source.node.ts` supplies the real one. */
export type NodeEnvFileReader = (mode: string) => Record<string, string>;

let nodeEnvFileReader: NodeEnvFileReader | undefined;

/** Activates (or, with `undefined`, deactivates — tests use this to isolate) file-backed reading. */
export function setNodeEnvFileReader(reader: NodeEnvFileReader | undefined): void {
  nodeEnvFileReader = reader;
}

/**
 * Merged env for a Node process: whatever the registered file reader returns
 * for the current `NODE_ENV` (nothing, if none is registered — see the file
 * doc comment) as defaults, with real `process.env` values winning so CI and
 * shell exports always take precedence over a checked-in or gitignored file.
 */
export function readNodeEnv(
  processEnv: NodeJS.ProcessEnv = process.env,
): Record<string, string | undefined> {
  const mode = processEnv.NODE_ENV ?? 'development';
  const fromFile = nodeEnvFileReader?.(mode) ?? {};
  return { ...fromFile, ...processEnv };
}

/** True in a real browser (and nowhere Node runs — Vitest's `jsdom` environment included). */
export function isBrowserLike(
  scope: Record<string, unknown> = globalThis as Record<string, unknown>,
): boolean {
  return scope.document !== undefined;
}
