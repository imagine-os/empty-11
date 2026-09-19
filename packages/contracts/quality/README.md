# @paperos/contract-quality

Quality module contract (`docs/module-system.md` §2). PAP-79 lands the review vocabulary here; PAP-239 adds the gate artefact schemas; PAP-462 publishes v0.1 with the module manifest.

| File | What |
|---|---|
| `src/finding.ts` | `Finding` Zod schema, `findingId()`, gate rule (`gateDecision`), confidence rule, caps, waivers, dedupe |
| `src/rubrics.ts`, `src/rubrics/*.json` | eight rubrics (`RUB-<DOMAIN>-<nn>`) and `severity.json`, parsed and indexed |
| `src/render.ts` | Markdown review renderer (the review comment template) |
| `src/calibrate.ts` | calibration case and reviewer output schemas, `calibrate()` scorer |
| `schemas/*.schema.json` | generated JSON Schemas (`pnpm build:schemas`), drift-tested |
| `fixtures/sample-review.json` | demo reviewer output: 13/15 agreement with two disagreements |
| `scripts/` | `build-schemas`, `build-docs` (writes `docs/quality/rubrics/<domain>.md`), `calibrate` CLI |

Human docs: `docs/quality/rubrics/README.md`. Contract rules: types, Zod schemas and pure helpers only; no React, no database, no network, no environment reads (lint R9, `size-limit` in PAP-462).

```sh
pnpm --filter @paperos/contract-quality test
pnpm --filter @paperos/contract-quality build
pnpm --filter @paperos/contract-quality calibrate fixtures/sample-review.json
```
