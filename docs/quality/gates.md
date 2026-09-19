# Gate artifacts and statuses (PAP-239)

Every quality gate in PaperOS writes one JSON artifact under `reports/` and publishes one or
more commit statuses. This page is the contract those artifacts follow, owned by the quality
module in [`packages/contracts/quality`](../../packages/contracts/quality/README.md)
(`@paperos/contract-quality`). CI jobs, the orchestrator webhooks (PAP-97), the release digest
(PAP-89) and the QA viewer (PAP-137) read the same JSON through the same schemas; nobody
defines an artifact shape anywhere else.

Gate 1 itself (steps, root checks, determinism) is documented by PAP-78 in
[`gate-1.md`](./gate-1.md). The review vocabulary every artifact reuses, `Finding`, severities
and rubric ids, is PAP-79's [`rubrics/`](./rubrics/README.md).

## The envelope: `GateReport<K>`

```ts
{
  kind: K,                 // one of the registered kinds below; reports/<kind>.json
  version: 1,              // envelope version, see "Versioning"
  sha: string,             // commit the gate ran against, 7..40 hex
  pr?: number,             // absent on main and nightly runs
  startedAt: string,       // ISO 8601 UTC
  finishedAt: string,      // not before startedAt
  status: 'pass' | 'fail' | 'error' | 'skipped',
  findings: Finding[],     // PAP-79 shape; consumers dedupe by (reviewer, id)
  summary: string,         // one paragraph a human reads first; required on every status
  artifacts: ArtifactRef[],
  producer?: ActorRef,     // the agent or service that wrote it
  data: KindSpecific       // per kind, tables below
}
```

Schemas are strict: an unknown key is an error, not a silent drop. Two rules hold across every
kind: `finishedAt >= startedAt`, and a `pass` never carries findings that trip the gate rule
(any S0, or more than three S1, waivers honoured). A gate that ran but produced nothing usable
(API outage, cancelled matrix, runner died) reports `status: 'error'` with a `summary`, never an
empty `pass`; the runner owns that decision and the schema makes the contradictory case
unrepresentable.

`Finding` is not redefined here. It is [`finding.ts`](../../packages/contracts/quality/src/finding.ts)
from PAP-79, with `findingId(reviewer, rubricId, file, title) = sha1(...)[:10]` (title normalised
for case, whitespace and trailing punctuation). Two gates may report the same finding id (the
vision agent and the edge-case hunter on the same overflow); consumers dedupe by `(reviewer, id)`
with `dedupeWithinReviewer()`.

## Artifacts and statuses

<!-- GENERATED:artifacts-and-statuses:start (packages/contracts/quality/scripts/generate.ts; edit src/gates/index.ts and src/status.ts, then run `pnpm --filter @paperos/contract-quality build:docs`) -->

Envelope version 1. Every artifact is `reports/<kind>.json`; its JSON Schema is `packages/contracts/quality/schemas/<kind>.schema.json`.

| Kind | File | Producer | Statuses | Consumers | What `data` holds |
|---|---|---|---|---|---|
| `gate1` | `reports/gate1.json` | PAP-78 | `gate/1-static` | PAP-81, PAP-243, PAP-89, PAP-97 | static gate: jobs, failures, PR class, env |
| `security` | `reports/security.json` | PAP-80 | `gate/1-security`, `gate/dast` | PAP-245, PAP-88, PAP-89, PAP-97, PAP-217 | merged scanner results, SBOM, waiver state; DAST entries carry `tool: zap` |
| `perf` | `reports/perf.json` | PAP-87 | `gate/1-perf` | PAP-242, PAP-88, PAP-89, PAP-217 | web vitals and bundle budgets; `data.api` from PAP-242 |
| `coverage` | `reports/coverage.json` | PAP-681 | `gate/1-coverage` | PAP-243, PAP-89 | diff coverage of changed lines against the budget |
| `migrations` | `reports/migrations.json` | PAP-682 | `gate/1-migrations` | PAP-254, PAP-89 | per-migration reversibility and rule hits; `migration-ack` |
| `conformance` | `reports/conformance.json` | PAP-441 | `gate/1-static` | PAP-248, PAP-442, PAP-446 | module conformance suites against the default implementation |
| `review` | `reports/review.json` | PAP-243 | `gate/2-correctness`, `gate/2-security`, `gate/2-spec`, `gate/2-docs`, `gate/2-review` | PAP-97, PAP-241, PAP-89, PAP-110 | one reviewer run: findings, rubric coverage, verdict, model routing |
| `review-cost` | `reports/review-cost.json` | PAP-243 | none (informational) | PAP-98, PAP-680 | tokens, cost and duration per reviewer run |
| `visual` | `reports/visual.json` | PAP-248 | `gate/3-visual` | PAP-84, PAP-89, PAP-137, PAP-97 | screenshots per breakpoint and theme with baseline diffs and contact sheets |
| `videos` | `reports/videos.json` | PAP-83 | `gate/3-video` | PAP-84, PAP-89, PAP-137, PAP-90 | flow recordings per width and theme with step captions |
| `vision` | `reports/vision.json` | PAP-84 | `gate/3-vision` | PAP-85, PAP-89, PAP-137 | vision agent findings per screenshot with layout scores and boxes |
| `e2e` | `reports/e2e.json` | PAP-86 | `gate/3-e2e` | PAP-90, PAP-89, PAP-687, PAP-690 | functional flow runs per project, engine and target |
| `edgecases` | `reports/edgecases.json` | PAP-85 | `gate/4-edge` | PAP-251, PAP-89, PAP-90 | edge-case scenario matrix with repro test paths |
| `flakes-delta` | `reports/flakes-delta.json` | PAP-90 | none (informational) | PAP-90, PAP-89 | tests that passed only on retry in this run |
| `mutation` | `reports/mutation.json` | PAP-686 | none (informational) | PAP-89 | nightly mutation scores and survivors per package |
| `calibration` | `reports/calibration.json` | PAP-241 | none (informational) | PAP-89 | weekly reviewer agreement against the calibration set |
| `certification` | `reports/certification.json` | PAP-254 | none (informational) | PAP-88, PAP-89, PAP-97 | release-candidate checks and the certified flag |

| Status | Gate | Owner | What it means |
|---|---|---|---|
| `gate/1-static` | Gate 1 | PAP-78 | lint, typecheck, test, coverage floor, build, generated-file drift, boundaries |
| `gate/1-security` | Gate 1 | PAP-80 | secret, dependency, SAST and container scans merged from SARIF |
| `gate/1-perf` | Gate 1 | PAP-87 | Lighthouse and bundle budgets (web), k6 and query budgets (api, PAP-242) |
| `gate/1-coverage` | Gate 1 | PAP-681 | diff coverage of the changed lines against the budget |
| `gate/1-migrations` | Gate 1 | PAP-682 | migration safety lint; destructive steps need `migration-ack` |
| `gate/2-correctness` | Gate 2 | PAP-244 | correctness reviewer agent |
| `gate/2-security` | Gate 2 | PAP-245 | security reviewer agent, reads security.json and the waivers |
| `gate/2-spec` | Gate 2 | PAP-244 | spec-conformance reviewer agent |
| `gate/2-docs` | Gate 2 | PAP-677 | docs-and-spec reviewer agent on specs, docs, prompts, ADRs and changelogs |
| `gate/2-review` | Gate 2 | PAP-81 | aggregate of the gate 2 reviewers; the merge gate |
| `gate/3-visual` | Gate 3 | PAP-82 | screenshot suite across the breakpoint matrix and themes with baseline diffs |
| `gate/3-video` | Gate 3 | PAP-83 | video replays of critical flows per width and theme |
| `gate/3-vision` | Gate 3 | PAP-84 | vision agent inspection of screenshots for overflow, misalignment, contrast, truncation |
| `gate/3-e2e` | Gate 3 | PAP-86 | functional Playwright flows; cross-browser and desktop targets (PAP-687, PAP-690) |
| `gate/4-edge` | Gate 4 | PAP-85 | edge-case hunter scenarios derived from page specs |
| `gate/dast` | release candidate | PAP-675 | nightly ZAP baseline and weekly authenticated scan on the release-candidate branch |

<!-- GENERATED:artifacts-and-statuses:end -->

The two tables are generated from `GATE_KINDS` / `GATE_KIND_INFO` and `GATE_STATUSES` /
`GATE_STATUS_INFO`; a kind or status present in the code and not here, or the other way round,
fails the drift test and `pnpm --filter @paperos/contract-quality build`. `gates/required`
(PAP-78 round-4 amendment) is the one aggregate status PAP-46 marks as required; it is computed
from the PR class and this registry, never published by a gate.

## Artifact references and paths

```ts
ArtifactRef = { kind: 'screenshot' | 'video' | 'report' | 'log' | 'sarif', path, url?, sha256?, expiresAt? }
```

* `path` is relative to `reports/` in the run: forward slashes, no leading slash, no `.` or `..`
  segments, no whitespace. Conventions: the report itself is `<kind>.json`; per-step logs
  `gate1/<step>.log`; screenshots `visual/<page>/<width>-<theme>.png` (PAP-82 also names them
  `screenshots/<page>/<width>.png` in the PR status comment); contact sheets
  `visual/sheets/<page>.png`; videos `videos/<flow>/<width>-<theme>.mp4` with `.poster.png` and
  `.sheet.png` beside them; SARIF `security/<tool>.sarif`.
* `url` is present only when the file was published. GitHub Pages form:
  `https://<pages>/pr/<n>/<path>`, built by `artifactUrl(pr, path, pagesHosting(base))`. On a
  Forgejo-hosted PR, or any run without Pages, `artifactUrl` falls back to the run artifact
  link (`runArtifactHosting(url)`), because the file lives inside the archive. With no hosting,
  or no PR number under Pages, it returns `undefined` and the `url` field is omitted.
* A file over the Pages limit (`PAGES_MAX_FILE_BYTES`, 100 MB) is not published: `artifactRef()`
  omits `url` and keeps `path` as the run-artifact reference.
* `expiresAt` marks signed URLs (MinIO video links, 30 days); `sha256` pins a file the digest
  quotes.

## Validating

```sh
pnpm --filter @paperos/contract-quality validate reports/visual.json          # exit 0
pnpm --filter @paperos/contract-quality validate fixtures/visual.bad-severity.json
#  fixtures/visual.bad-severity.json: invalid visual
#    findings.0.severity: Invalid option: expected one of "S0"|"S1"|"S2"|"S3"|"question"|"praise"
```

Exit codes: 0 valid, 1 invalid (every issue with its path), 2 usage, unreadable file or unknown
kind. The kind comes from the file name (`reports/visual.json` is `visual`), `--kind` overrides
it, and a file with another name is validated against the document's own `kind`. In TypeScript,
`validateArtifact(kind | 'auto', json)` returns `{ ok, report }` or `{ ok: false, issues }` and
never throws; `parseArtifact(kind, json)` throws with the issues listed; `readGateReport(fileName,
json)` adds the version upgrade step. Non-TypeScript consumers (the orchestrator, PAP-96 and
PAP-97) validate against the generated JSON Schemas in
[`packages/contracts/quality/schemas/`](../../packages/contracts/quality/schemas/): one
`<kind>.schema.json` per kind plus `artifact-ref.schema.json`, `gate-status.schema.json` and
PAP-79's `finding.schema.json`. They are generated from the Zod sources by
`pnpm --filter @paperos/contract-quality build:schemas` and drift-tested; never hand-edit them.

Fixtures for every kind live in `packages/contracts/quality/fixtures/`: `<kind>.pass.json` for
each of the seventeen kinds, `gate1.fail.json`, and the invalid set (`visual.bad-severity.json`,
`gate1.bad-status.json`, `security.pass-with-s0.json`, `videos.unknown-key.json`,
`perf.wrong-kind.json`, `coverage.time-travel.json`, `edgecases.absolute-path.json`,
`visual.unsupported-version.json`), each pinned to the path of the first issue it must report.

## Versioning

`version` is the envelope version, `1` today (`GATE_REPORT_VERSION`). The rule is the one the
domain event envelope follows (Interface & Data Contracts §3):

* An **additive** change (a new optional field, a new kind, a new status) keeps `version: 1`
  and bumps the package's minor version.
* A **breaking** change (a field removed, renamed or retyped, a kind's `data` reshaped) bumps
  `version`, needs an ADR (PAP-130) and keeps a reader for the previous version for 30 days:
  `readGateReport()` upgrades an older document through the reader registered for its
  version, so a consumer written against the new shape still reads artifacts produced by
  workflows that have not redeployed. After 30 days the reader is removed and
  `SUPPORTED_REPORT_VERSIONS` shrinks; an unsupported version fails validation at `version`
  with the versions that still have readers.
* Kinds and statuses are registries: adding one is a change to `GATE_KINDS` or
  `GATE_STATUSES`, this page (generated) and the changelog, in one commit.

## Consumers and producers

Producers write with `parseArtifact(kind, report)` (or their own schema import) before the file
leaves the job, so a malformed artifact fails the producing job, not the reader. Consumers:
PAP-78 (gate 1), PAP-80 (security), PAP-81 and PAP-243 (reviewers), PAP-82 and PAP-248 (visual),
PAP-83 (videos), PAP-84 (vision), PAP-85 (edge cases), PAP-87 (perf), PAP-88 and PAP-254
(certification), PAP-89 (digest), PAP-90 (flakes), PAP-97 (orchestrator status comment),
PAP-110 (eval harness), PAP-137 (QA viewer), PAP-441 (conformance), PAP-462 (publishes the
package). PAP-78's `packages/gate/src/gate1.ts` was written to this contract before it landed
and becomes a re-export of `@paperos/contract-quality/gates`.
