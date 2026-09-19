# Evidence: PAP-239 gate artifact contract

Definition-of-done evidence for the gate artifact contract in `packages/contracts/quality`
(`@paperos/contract-quality`). Everything here is reproducible from the repo:

```sh
pnpm --filter @paperos/contract-quality build        # schemas/*.schema.json and the docs/quality/gates.md tables
pnpm --filter @paperos/contract-quality test         # 84 tests, drift tests included
pnpm --filter @paperos/contract-quality validate fixtures/visual.pass.json
pnpm --filter @paperos/contract-quality validate fixtures/visual.bad-severity.json
```

## Demo transcript (spec "Demo": pass, then bad severity with its path, under one minute)

```
$ pnpm --filter @paperos/contract-quality validate fixtures/visual.pass.json
fixtures/visual.pass.json: valid visual artifact (status fail, 0 findings)
exit 0

$ pnpm --filter @paperos/contract-quality validate fixtures/visual.bad-severity.json
fixtures/visual.bad-severity.json: invalid visual
  findings.0.severity: Invalid option: expected one of "S0"|"S1"|"S2"|"S3"|"question"|"praise"
exit 1

$ pnpm --filter @paperos/contract-quality validate fixtures/security.pass-with-s0.json
fixtures/security.pass-with-s0.json: invalid security
  status: a pass must not carry findings that trip the gate rule (S0, or more than 3 S1)
exit 1

$ pnpm --filter @paperos/contract-quality validate fixtures/visual.pass.json --kind lighthouse
unknown kind "lighthouse"; kinds: gate1, security, perf, coverage, migrations, conformance, review, review-cost, visual, videos, vision, e2e, edgecases, flakes-delta, mutation, calibration, certification
exit 2
```

## What the DoD asked for and where it is

| DoD item | Where |
| -- | -- |
| Package builds; JSON Schemas generated and committed | `packages/contracts/quality/schemas/`: 17 `<kind>.schema.json` + `artifact-ref`, `gate-status` (+ PAP-79's six). `pnpm build` regenerates; `test/drift.test.ts` fails on drift |
| Drift check wired into Gate 1 (or `pnpm check` until PAP-78 merges) | drift test runs in `pnpm test`; PAP-78's `scripts/drift-check.ts` already runs `pnpm --filter @paperos/contract-quality run build` and waits on a root `gen:schemas` alias (owed PAP-13 edit) |
| Fixture artifacts for every kind validate; a wrong severity fails with a path | `fixtures/<kind>.pass.json` x17, `gate1.fail.json`; `visual.bad-severity.json` fails at `findings.0.severity` (transcript above); `test/gates.test.ts` |
| `findingId` stability across whitespace and case | PAP-79's `test/finding.test.ts` ("is stable under whitespace and case changes in the title"); `test/gates.test.ts` re-derives every fixture finding id |
| Consumers PAP-78, 80, 81, 82, 84, 85, 89 carry a comment confirming they import from `packages/contracts` | comments posted by this session on each issue (Linear) |
| `docs/quality/gates.md` section "Artifacts and statuses"; changelog under Quality | `docs/quality/gates.md` (generated tables), `docs/changelog/unreleased/PAP-239.md` |

## Test plan coverage

* Unit, every schema against valid and invalid fixtures: `test/gates.test.ts` (8 invalid fixtures pinned to the path of their first issue).
* `artifactUrl` for GitHub Pages and Forgejo hosting, size limit, escapes: `test/artifacts.test.ts`.
* Status registry completeness against the docs table: `test/status.test.ts` and the generated block check in `test/drift.test.ts`.
* Integration, `validate` CLI exit codes 0 / 1 / 2: `test/validate-cli.test.ts` (spawns the CLI).
