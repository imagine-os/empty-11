import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';

/** The one shape this test needs out of Rollup's output chunk — avoids depending on `rollup`'s own types directly. */
interface MinimalRollupOutput {
  output: ReadonlyArray<{ code?: string }>;
}

/**
 * The DoD's "bundle guard, proven": actually run a client (browser-target)
 * build through Vite — the same bundler `apps/web` uses — of a fixture entry
 * that imports the public accessors from this config layer, and assert none
 * of `serverEnvSchema`'s key names (`DATABASE_URL`, `BETTER_AUTH_SECRET`, ...)
 * survive into the output. This is a regression test for a real bug found
 * while building this issue: without the `/* @__PURE__ *\/` annotations on
 * `serverEnvSchema` / `publicEnv` / `serverEnv` (see `schema.ts` and
 * `load.ts`), Rollup could not prove those top-level initializers were
 * side-effect-free and kept them — and their literal key strings — in a
 * bundle that only ever called `getPublicEnv()`.
 */
describe('bundle leak guard', () => {
  const SERVER_ONLY_NAMES = [
    'DATABASE_URL',
    'DATABASE_URL_MIGRATOR',
    'BETTER_AUTH_SECRET',
    'BETTER_AUTH_URL',
    'S3_ACCESS_KEY',
    'S3_SECRET_KEY',
    'STRIPE_SECRET_KEY',
    'APP_ENCRYPTION_KEY',
  ];

  it('a client build importing only getPublicEnv/getTarget/getSecretStore never bundles a server-only key name', async () => {
    const configIndex = new URL('./index.ts', import.meta.url).pathname;
    const dir = mkdtempSync(join(tmpdir(), 'paperos-bundle-leak-'));
    const entry = join(dir, 'entry.ts');
    writeFileSync(
      entry,
      [
        `import { getPublicEnv, getSecretStore, getTarget } from ${JSON.stringify(configIndex)};`,
        'export const target = getTarget();',
        'export const config = getPublicEnv;',
        'export const store = getSecretStore;',
        '',
      ].join('\n'),
    );

    try {
      const result = await build({
        configFile: false,
        logLevel: 'silent',
        build: {
          write: false,
          // Real production builds (`apps/web`'s `vite build`) minify with
          // esbuild by default, which is what actually strips the dead
          // `z.object({...})` statement Rollup's own tree-shake conservatively
          // leaves behind (it cannot prove every nested chain call pure, so it
          // keeps evaluating them as an orphaned expression). Matching that
          // default here is what makes this test reflect what ships, not an
          // artificially stricter unminified check.
          lib: { entry, formats: ['es'], fileName: () => 'entry.js' },
          rollupOptions: { external: ['zod'] },
        },
      });

      // Vite 7's build() returns an array of per-environment RollupOutput.
      const outputs = (Array.isArray(result) ? result : [result]) as MinimalRollupOutput[];
      const code = outputs
        .flatMap((output) => output.output)
        .map((chunk) => ('code' in chunk ? chunk.code : ''))
        .join('\n');

      for (const name of SERVER_ONLY_NAMES) {
        expect(code).not.toContain(name);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
