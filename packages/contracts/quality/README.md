# @paperos/contract-quality

Quality module contract (`docs/module-system.md` §2). PAP-79 lands the review vocabulary here; PAP-239 adds the gate artefact schemas; PAP-462 publishes v0.1 with the module manifest.

| File | What |
|---|---|
| `src/finding.ts` | `Finding` Zod schema, `findingId()`, gate rule (`gateDecision`), confidence rule, caps, waivers, dedupe |
| `src/status.ts` | `GATE_STATUSES` registry (16 commit statuses, typo-safe), `GATE_STATES`, `GATE_STATUS_INFO` (PAP-239) |
| `src/artifacts.ts` | `ArtifactRef`, path rules, `artifactUrl()` (Pages / Forgejo run artifact), `artifactRef()` with the Pages size limit (PAP-239) |
| `src/gates/` | `defineGateReport()` envelope and one module per kind (`gate1`, `security`, `visual`, ...); `GATE_KINDS`, `GATE_REPORT_SCHEMAS`, `GATE_KIND_INFO` in `index.ts` (PAP-239) |
| `src/validate.ts` | `validateArtifact(kind \| 'auto', json)`, `parseArtifact()`, `readGateReport()` with the version-reader hook (PAP-239) |
| `src/rubrics.ts`, `src/rubrics/*.json` | eight rubrics (`RUB-<DOMAIN>-<nn>`) and `severity.json`, parsed and indexed |
| `src/render.ts` | Markdown review renderer (the review comment template) |
| `src/calibrate.ts` | calibration case and reviewer output schemas, `calibrate()` scorer |
| `schemas/*.schema.json` | generated JSON Schemas (`pnpm build:schemas`), drift-tested: PAP-79's six plus `<kind>.schema.json` per gate kind, `artifact-ref`, `gate-status` |
| `fixtures/sample-review.json` | demo reviewer output: 13/15 agreement with two disagreements |
| `fixtures/<kind>.pass.json`, `*.bad-*.json` and friends | one valid artifact per kind, `gate1.fail.json`, and eight invalid ones pinned to the path they fail at |
| `scripts/` | `build-schemas`, `build-docs` (writes `docs/quality/rubrics/<domain>.md` and the tables of `docs/quality/gates.md`), `calibrate` CLI, `validate` CLI |

Human docs: `docs/quality/rubrics/README.md` (review vocabulary) and `docs/quality/gates.md` (artifacts and statuses). Contract rules: types, Zod schemas and pure helpers only; no React, no database, no network, no environment reads (lint R9, `size-limit` in PAP-462).

```sh
pnpm --filter @paperos/contract-quality test
pnpm --filter @paperos/contract-quality build
pnpm --filter @paperos/contract-quality calibrate fixtures/sample-review.json
pnpm --filter @paperos/contract-quality validate fixtures/visual.pass.json          # exit 0
pnpm --filter @paperos/contract-quality validate fixtures/visual.bad-severity.json  # exit 1, prints findings.0.severity
```
