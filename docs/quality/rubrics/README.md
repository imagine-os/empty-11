# Review rubrics and severity taxonomy (PAP-79)

The shared vocabulary for judging work in PaperOS. Every reviewer agent (correctness, security, spec-conformance, docs-and-spec), the vision inspector, the edge-case hunter, the accessibility audit and Justin use the same severity names, the same checklist ids and the same finding shape, so a "blocker" means one thing everywhere and findings can be counted, trended and turned into gate decisions by a script.

Start here, then follow the gate rule to [severity.md](./severity.md).

## The three things everyone shares

| What | Where | Used by |
|---|---|---|
| Severity taxonomy `S0 blocker`, `S1 major`, `S2 minor`, `S3 nit`, kinds `question`, `praise`; the gate rule; caps; waivers | [severity.md](./severity.md), machine form `packages/contracts/quality/src/rubrics/severity.json` | Gate 2 (PAP-81), Gate 3 vision (PAP-84), Gate 4 (PAP-85), PAP-80 scanner mapping, PAP-88 certification, PAP-89 digest |
| Checklist items `RUB-<DOMAIN>-<nn>`, one question each with typical severity, how to verify and false-positive notes | the eight rubric files below, machine form `packages/contracts/quality/src/rubrics/<domain>.json` | reviewer prompts (PAP-244, PAP-245, PAP-677), oracles (PAP-85), `rubricCoverage` |
| `Finding` shape and `findingId()` | [finding.schema.json](./finding.schema.json), TypeScript `packages/contracts/quality/src/finding.ts` | every gate artefact (PAP-239), review posting (PAP-243), calibration (PAP-241) |

## Rubrics by domain

| Domain | Ids | File | Applied by |
|---|---|---|---|
| Correctness | `RUB-COR-01..10` | [correctness.md](./correctness.md) | correctness reviewer, edge-case hunter |
| Security | `RUB-SEC-01..11` (cite `SEC-*` controls) | [security.md](./security.md) | security reviewer |
| Spec conformance | `RUB-SPEC-01..10` | [spec-conformance.md](./spec-conformance.md) | spec-conformance reviewer |
| Visual | `RUB-VIS-01..10` | [visual.md](./visual.md) | vision inspector, Justin |
| Accessibility | `RUB-A11Y-01..10` | [accessibility.md](./accessibility.md) | a11y audit, vision inspector, spec-conformance reviewer |
| Performance | `RUB-PERF-01..08` (thresholds in PAP-87 / PAP-242) | [performance.md](./performance.md) | correctness reviewer, edge-case hunter |
| Docs and changelog | `RUB-DOC-01..08` | [docs-and-changelog.md](./docs-and-changelog.md) | docs-and-spec reviewer |
| Agent behaviour | `RUB-AGENT-01..08` | [agent-behaviour.md](./agent-behaviour.md) | harness, docs-and-spec reviewer, calibration auditor |

The eight domain files are **generated** from the JSON under `packages/contracts/quality/src/rubrics/`; edit the JSON and run `pnpm --filter @paperos/contract-quality build:docs`. A drift test fails when a committed copy is stale. `severity.md`, this README and the template are hand-written.

Each rubric file has the same sections: purpose, scope, examples of S0, S1 and S2 (S3 where it matters), the checklist table (id, item, one-line test phrased "Can I construct an input that...", typical severity, how to verify, false positives) and "what this rubric does not cover".

## How a reviewer uses this

1. Read the issue, the spec, the PR body and the diff in full, then the tests.
2. Walk your rubric's checklist. For every item record `checked`, `n/a` or `skipped` in `rubricCoverage`, so silence is distinguishable from a skipped check.
3. For every hit, write a `Finding`: file and line where one applies, a one-sentence claim as the title, the concrete failure scenario and the test that would prove it in the body, evidence for any claim about command or test output, a confidence, and a suggestion diff when the fix is mechanical (`autofixable: true`).
4. Start from the item's typical severity; apply the [severity taxonomy](./severity.md), its caps (generated files S2, third-party code S3) and the confidence rule (under 0.5 posts as `question`).
5. Never rewrite the author's code in the review; describe the defect. Never approve your own work. Post once through the harness so re-runs update rather than duplicate.
6. Render with the [review comment template](./review-comment-template.md): counts by severity in the header, findings grouped by severity, each with file link, rubric id and suggestion block.

## Machine-readable forms and tooling

Package `@paperos/contract-quality` (`packages/contracts/quality/`, homed there for PAP-239 and published by PAP-462):

| Export | Purpose |
|---|---|
| `FindingSchema`, `Finding`, `findingId()`, `makeFinding()` | the finding shape and its deterministic id (`sha1(reviewer, rubricId, file, normalizedTitle)[:10]`, fields joined by U+001F) |
| `gateDecision()`, `GATE_RULE`, `applyConfidenceRule()`, `capSeverity()`, `effectiveSeverity()`, `dedupeWithinReviewer()` | the gate rule and the taxonomy's edge rules as code |
| `RUBRICS`, `RubricSchema`, `findRubricItem()`, `rubricExists()`, `rubricsForReviewer()` | the checklist registry |
| `SEVERITY_TAXONOMY` | severity.json, parsed |
| `renderReview()` | the Markdown template |
| `calibrate()`, `CalibrationCaseSchema`, `ReviewerOutputSchema` | calibration scoring |
| `schemas/*.schema.json` | generated JSON Schemas for non-TypeScript consumers (orchestrator, webhooks) |

Commands (from the repo root):

```sh
pnpm --filter @paperos/contract-quality test          # schema, id, gate rule, render snapshot, calibration and drift tests
pnpm --filter @paperos/contract-quality build         # regenerate schemas/ and docs/quality/rubrics/<domain>.md
pnpm --filter @paperos/contract-quality calibrate fixtures/sample-review.json   # agreement score and disagreements
```

`pnpm rubrics:calibrate <output.json>` is the spec's name for the last command; it is a root-script alias PAP-13's owner adds (root `package.json` is not edited by this issue).

## Calibration set

`calibration/<case>/{input.md, expected.json}`: 15 cases across every domain and every severity plus one clean PR. `expected.json` lists the findings a calibrated reviewer reports (rubric id, severity, title, file, rationale, and the reviewers each finding is addressed to). A case agrees when every expected S0..S2 finding addressed to the reviewer is present at the same severity and no unexpected S0 or S1 appears; an expected S3 is optional. PAP-81 requires agreement at or above 0.8 per reviewer; PAP-241 re-scores weekly. Adding a case: new folder, `expected.json` validated by `CalibrationCaseSchema`, every `RUB-*` it cites must exist (tested).

## Edge rules (from the issue)

- Finding in a generated file: capped at S2, points at the generator.
- Two reviewers on the same line: both kept, highest governs; dedupe only within a reviewer (`dedupeWithinReviewer`).
- Not-applicable rubric item: reviewers emit `n/a` in `rubricCoverage`, so silence differs from skipped.
- Justin overrides a severity: recorded as a `waiver { reason, approvedBy, expires }` on the finding, never a silent edit.
- Third-party code: S3 with a pointer to PAP-216.

## Related

- [review-rubrics.md](../review-rubrics.md): one-page entry point and how the current build loop's review pass applies these before an issue moves to Done.
- ADR [0023-review-rubrics](../../adr/0023-review-rubrics.md).
- Consumers: PAP-81 (reviewer agents), PAP-84 (vision), PAP-85 (edge cases), PAP-73 (a11y audit), PAP-80 (scanner severity mapping), PAP-239 (gate artefact contract), PAP-241 (calibration), PAP-89 (digest).
