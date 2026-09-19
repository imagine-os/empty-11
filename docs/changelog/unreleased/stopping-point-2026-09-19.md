### Fixed — stopping point 2026-09-19: main's `check` is green again

- Sorted the `@paperos/core` barrel exports (Biome `organizeImports`, left unsorted by union-merges
  of `packages/core/src/index.ts`), registered `packages/core/src/config` in `ownership.json`
  (PAP-17 added the folder without an entry), regenerated `docs/platform/dependency-map.json` /
  `.md` (new `apps/web -> packages/core` edge via `apps/web/src/config.ts`), and made
  `apps/web/src/config.test.ts` deterministic from the root and the package (`vi.stubEnv`, since
  the root Vitest config loads `.env.test`).
- Paths: `packages/core/src/index.ts`, `ownership.json`, `docs/platform/dependency-map.*`,
  `apps/web/src/config.test.ts`.
- The build loop paused here at Justin's request; the open feature branches are left for the
  next pass.
