import type { Plugin } from 'vite';

/**
 * Fails a client build the moment source code reads a variable it must
 * never see: `process.env.*` (browsers have no such thing; Vite never
 * defines it) or `import.meta.env.*` for any name that is not `VITE_`-prefixed
 * (Vite's own convention — only `VITE_`-prefixed keys are meant to reach the
 * client — this plugin turns that convention into a build failure instead of
 * a silent `undefined`).
 *
 * Runs as an early (`enforce: 'pre'`) `transform` hook, scanning source text
 * before Vite's own `define` substitution, so it sees the literal
 * `import.meta.env.SECRET` in the file that wrote it — the DoD's "bundle
 * guard" scenario: "a test build with a stray `SECRET=` import fails."
 *
 * `packages/core/src/config/**` itself is exempt (and any extra `allow`
 * segment a caller adds): that folder is the one place per
 * `docs/module-system.md` §4 and PAP-444's lint rule R12 that is allowed to
 * read `process.env` / `import.meta.env` directly, because it is the code
 * that *implements* the config layer, not client code consuming it.
 */
const CONFIG_FOLDER_SEGMENT = 'packages/core/src/config/';

const IMPORT_META_ENV_LEAK = /import\.meta\.env\.(?!VITE_)[A-Za-z_$][A-Za-z0-9_$]*/g;
const PROCESS_ENV_LEAK = /process\.env(?:\.[A-Za-z_$][A-Za-z0-9_$]*|\[)/g;

export interface EnvGuardOptions {
  /** Extra path segments (matched as a substring) to exempt besides the config folder itself. */
  allow?: readonly string[];
}

/** Every offending match found in `code`, deduplicated, or `[]` when the file is clean. */
export function findEnvLeaks(code: string): string[] {
  const found = new Set<string>();
  for (const match of code.matchAll(IMPORT_META_ENV_LEAK)) found.add(match[0]);
  for (const match of code.matchAll(PROCESS_ENV_LEAK)) found.add(match[0].replace(/\[$/, '[...]'));
  return [...found];
}

/** True when `id` (a Vite module id) is inside the config folder or an explicitly allowed segment. */
export function isExemptModule(id: string, allow: readonly string[] = []): boolean {
  const normalized = id.replaceAll('\\', '/');
  if (normalized.includes('/node_modules/')) return true;
  return [CONFIG_FOLDER_SEGMENT, ...allow].some((segment) => normalized.includes(segment));
}

/**
 * The Vite plugin. Add it to `apps/web/vite.config.ts` (and the desktop /
 * mobile webview configs once they exist):
 *
 * ```ts
 * import { paperosEnvGuard } from '@paperos/core/config';
 * export default defineConfig({ plugins: [react(), paperosEnvGuard()] });
 * ```
 */
export function paperosEnvGuard(options: EnvGuardOptions = {}): Plugin {
  return {
    name: 'paperos:env-guard',
    enforce: 'pre',
    transform(code, id) {
      if (isExemptModule(id, options.allow)) return null;

      const leaks = findEnvLeaks(code);
      if (leaks.length > 0) {
        this.error(
          `paperos:env-guard — ${id} reads ${leaks.join(', ')}. Only VITE_-prefixed names may ` +
            'reach a client bundle (packages/core/src/config/schema.ts publicEnvSchema); read ' +
            'server-only config through @paperos/core/config on the server, never here.',
        );
      }
      return null;
    },
  };
}
