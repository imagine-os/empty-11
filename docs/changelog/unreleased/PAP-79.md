### Added — PAP-79: review rubrics, severity taxonomy and finding schema

- Severity taxonomy S0..S3 plus `question`/`praise` with the gate rule (any S0, more than 3 S1 block), caps and waivers; eight rubrics with 75 checklist items `RUB-<DOMAIN>-<nn>` (correctness, security, spec conformance, visual, accessibility, performance, docs and changelog, agent behaviour); `Finding` schema with deterministic `findingId`; review comment template; 15-case calibration set and scorer.
- Paths: `docs/quality/review-rubrics.md`, `docs/quality/rubrics/` (README, severity, template, generated domain docs, `finding.schema.json`, `calibration/`), `packages/contracts/quality/` (`@paperos/contract-quality`: `src/finding.ts`, `src/rubrics.ts`, `src/rubrics/*.json`, `src/render.ts`, `src/calibrate.ts`, `schemas/`, `fixtures/sample-review.json`, tests).
- Owed root edit (PAP-13 owner): `"rubrics:calibrate": "pnpm --filter @paperos/contract-quality calibrate"` and `zod` in the catalog.
- ADR: [0023-review-rubrics](../../adr/0023-review-rubrics.md)
