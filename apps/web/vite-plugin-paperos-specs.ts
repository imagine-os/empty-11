import type { Plugin } from 'vite';
import { parse } from 'yaml';

/**
 * `vite-plugin-paperos-specs` (named in the Interface contract): imports
 * `specs/**\/*.spec.yaml` as parsed JSON, so a route module can
 * `import spec from '../../../specs/pages/dashboard.spec.yaml'` and get a
 * plain object typed as `@paperos/spec`'s `PageSpec` (`vite-env.d.ts`).
 *
 * This is a bare YAML→JSON transform, not `@paperos/spec`'s real
 * `parseSpec` (PAP-114): `vite.config.ts`'s own module graph loads through
 * plain Node ESM resolution (not Vite's bundler-aware one), and every
 * workspace package's internal imports are `.js`-suffixed pointing at `.ts`
 * sources (`moduleResolution: "bundler"`) — a shape only a bundler or `tsx`
 * resolves, not plain Node, so importing `@paperos/spec`'s runtime code
 * here fails to load. Real schema validation of every `specs/pages/*.yaml`
 * file (including these three fixtures) runs where that resolution works
 * fine — as a Vitest suite, `src/specs/validate.test.ts` — which is what
 * `pnpm check` actually gates on.
 */
export function paperosSpecsPlugin(): Plugin {
  return {
    name: 'paperos-specs',
    transform(code, id) {
      if (!id.endsWith('.spec.yaml')) return undefined;
      const data = parse(code);
      return {
        code: `export default ${JSON.stringify(data)};`,
        map: null,
      };
    },
  };
}
