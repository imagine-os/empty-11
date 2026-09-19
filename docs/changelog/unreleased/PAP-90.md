### Fixed — PAP-90: quarantine wall-clock assertions and raise schema-generation test timeouts

- `packages/views` gets a package-wide `testTimeout: 60_000` so `json-schema.test.ts` (Zod → JSON
  Schema generation + ajv validation) has headroom under loaded/parallel `turbo` runs (9.2 s
  observed vs. vitest's 5 s default).
- `packages/core/src/filter/filter.perf.test.ts`: the 1 ms median-wall-clock budget only fails
  under `PAPEROS_PERF_STRICT=1`; otherwise it logs the median via `console.info`. New script
  `pnpm --filter @paperos/core test:perf` runs it strictly. Also raised the test's own timeout to
  30 s so the 300 warm-up/sample `toSql` calls can't hit the 5 s default under load.
- `packages/core/src/filter/filter.property.test.ts`: raised the PGlite `beforeAll` setup timeout
  to 120 s (matching the 500-case property test's own timeout) after one flake under 29-35
  concurrent turbo tasks; 500 cases unchanged.
- Paths: `packages/views/vitest.config.ts`, `packages/core/src/filter/filter.perf.test.ts`,
  `packages/core/src/filter/filter.property.test.ts`, `packages/core/package.json`.
- No ADR: process/CI-robustness change only, no contract or product shape changed.
