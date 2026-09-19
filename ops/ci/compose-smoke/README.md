# compose-smoke (PAP-754, ADR [0025](../../../docs/adr/0025-compose-smoke-workflow.md))

Scripts behind the reusable workflow
[`.github/workflows/compose-smoke.yml`](../../../.github/workflows/compose-smoke.yml): starts every
compose stack under `ops/compose/**` and `spikes/oss-products/*` that opts in, waits for it to
answer healthy, captures `docker stats`, and uploads one result JSON per stack. Built so the spike
issues (PAP-214, PAP-215 and children) and the resource budget table (PAP-296) get real numbers
instead of typed-in guesses.

## Discovery rules

The `discover` job walks two globs:

* `ops/compose/**/compose.yaml` (or `compose.yml`) — recursive, any depth.
* `spikes/oss-products/*/compose.yaml` (or `compose.yml`) — one level only; a compose file nested
  deeper inside a product folder is not picked up.

A compose file **without a sibling `smoke.json`** is skipped (logged, not an error — most compose
files under `ops/compose/` today are stubs with no service to smoke yet). A compose file whose
`smoke.json` sets `skipCi` is skipped too, and the reason is logged and surfaced in the job's
`discover` step output.

`workflow_dispatch`'s `compose-path` input narrows the matrix to exactly one entry (for the demo:
"dispatch compose-smoke on `ops/compose/example-postgres/compose.yaml`, watch it wait for health").

## `smoke.json` grammar

One `smoke.json` beside each `compose.yaml` it applies to:

```json
{
  "healthcheck": "http://localhost:8080/",
  "warmupSeconds": 15,
  "load": "load.sh",
  "ramBudgetMb": 256,
  "skipCi": "needs a real Stripe key"
}
```

| Field | Type | Required | Meaning |
| -- | -- | -- | -- |
| `healthcheck` | absolute URL string | yes | Polled by `probe.mjs` after `docker compose up --wait` and the warm-up sleep. Any response under 500 counts as healthy (a 404 still proves the process is up); this only needs an HTTP(S) endpoint, so a stack with no HTTP surface (bare Postgres, a worker) needs a small sidecar that exposes one — see `ops/compose/example-postgres/` for a worked example (a Postgres plus an Adminer sidecar for the probe to hit). |
| `warmupSeconds` | number | no (default `60`) | Slept after `up --wait` succeeds and before the health probe and any load script, for services whose HTTP port answers before migrations/seed finish. |
| `load` | string path | no | An optional script (relative to the repo root) run once the stack is healthy, before the "loaded" `docker stats` snapshot — e.g. a seed script that drives the flow the spike is measuring. |
| `ramBudgetMb` | number | no | Informational; read by PAP-296's budget-table script, not enforced here. |
| `skipCi` | string reason | no | When set, this stack is excluded from the discovered matrix (logged, not a failure) — for stacks that need a real credential compose-smoke cannot supply (edge case in the spec: measured by hand on staging, or run nightly through the credential broker, PAP-300). |

Validated by [`lib/smoke-config.mjs`](lib/smoke-config.mjs); ad-hoc check:

```bash
node ops/ci/compose-smoke/validate.mjs --type smoke ops/compose/example-postgres/smoke.json
```

### Deviation from the PAP-754 spec text

The Linear spec describes the grammar as an `x-paperos` extension field *inside* `compose.yaml`.
This implementation uses a sidecar `smoke.json` file instead, with the same fields. Reasoning: the
compose file itself only needs to be valid to `docker compose`, which every tool involved already
parses; teaching `discover.mjs` to also parse YAML would need either a YAML dependency (root
`pnpm-workspace.yaml` catalog edit — out of this issue's paths, see `CLAUDE.md` "Adding a package")
or a hand-rolled YAML subset parser, for no benefit over a small JSON file `JSON.parse` already
handles. The field names, defaults and semantics are unchanged from the spec; only the file that
carries them moved. Noted as a deviation in the PAP-754 `Session ended` comment.

## Result JSON

Shape (validated by [`lib/result-schema.mjs`](lib/result-schema.mjs), one per matrix entry,
artefact `compose-smoke/<name>.json`):

```json
{
  "name": "ops-compose-example-postgres",
  "startedMs": 1758246000000,
  "healthy": true,
  "ramIdleMb": 118.4,
  "ramLoadedMb": 142.1,
  "cpuPct": 2.3,
  "imageSizeMb": 214,
  "status": "ok"
}
```

`status` is one of `ok`, `unhealthy`, `timeout`, `skipped`. `timeout` covers `docker compose up
--wait --wait-timeout 600` giving up; if the **runner's own 20-minute job cap** (`timeout-minutes:
20`) is hit first, GitHub Actions force-cancels the job before any of these scripts can write a
result — that entry has no artefact and shows as a cancelled job with GitHub's own log, not a
`status: timeout` result row. The two are different failure modes; see "Follow-ups" below.

## Scripts

| File | Role | Docker needed to run it? |
| -- | -- | -- |
| `discover.mjs` | Walks the two globs, reads each `smoke.json`, prints/writes the `fromJson()` matrix. | No |
| `probe.mjs` | Polls a URL until it answers under 500 or the timeout elapses. | No (needs the URL to be reachable — a fake HTTP server stands in for tests) |
| `parse-docker-stats.mjs` | Pure parsing of `docker stats --format '{{json .}}'` lines (`MemUsage`, `CPUPerc`) into MB / percent, and aggregation across a stack's containers. | No |
| `aggregate-stats-file.mjs` | CLI wrapper the workflow shells out to: aggregate a captured stats file into one number, or `null` when nothing was captured. | No |
| `build-result.mjs` | Assembles and validates the final result JSON from the workflow's step outputs. | No |
| `validate.mjs` | Ad-hoc/CI validator CLI for a `smoke.json` or a result JSON file. | No |

Everything above is plain Node (built-in `fetch`, `node:http`, `node:fs`) — no new dependency, so
nothing here needed a `pnpm-workspace.yaml` catalog edit.

## Tests

```bash
node --test ops/ci/compose-smoke/__tests__/*.test.mjs
```

Not wired into `pnpm check`: the root `vitest.config.ts` only collects `apps/*`, `packages/*` and
`packages/contracts/*` (see `CLAUDE.md` "Adding a package"), and `ops/` is not one of those globs
on purpose — these scripts are CI plumbing, not a workspace package, so a real `zod` (see below)
or any other dependency here would need its own `pnpm-workspace.yaml` glob and catalog entry, which
is a root-file change out of this issue's paths. `node --test` needs nothing installed.

38 cases across schema validation, the health probe (against a real `node:http` server, including
a slow-then-healthy retry sequence and a hard timeout), `docker stats` line parsing, and matrix
discovery (against temp-directory fixtures covering: has `smoke.json`, missing it, invalid it,
`skipCi` set, and the one-level-only rule for `spikes/oss-products/*`).

### What could not be run

No Docker daemon is available in the build sandbox (`docker info` fails to reach
`/var/run/docker.sock`), so `docker compose up --wait`, the `docker stats`/`docker image inspect`
shell steps in the workflow, and `docker/setup-buildx-action` + `docker/bake-action` were not
exercised end to end. Mitigated by: the workflow YAML validates against GitHub's schema
(`@action-validator/cli`, and a plain PyYAML parse); every script the workflow shells out to is
unit-tested in isolation (health probe against a real HTTP server; stats-line parsing against
literal `docker stats` output samples taken from Docker's own documentation format; discovery
against fixture directories); and the timeout path is demonstrated by pointing `probe.mjs` at a
refused port (`docs/evidence/PAP-754/timeout-probe.log` — a captured CLI transcript standing in for
a screenshot, since there is no running container to screenshot). A future session with a real
Docker daemon (or a self-hosted runner) should run
`gh workflow run compose-smoke.yml -f compose-path=ops/compose/example-postgres/compose.yaml` and
attach the artefact as the first real integration evidence.

## Why not zod

The PAP-754 spec calls for the result schema to be "a Zod schema shared with PAP-296's budget
script." `zod` is not in `pnpm-workspace.yaml`'s `catalog:` today, and this repo's convention (see
`CLAUDE.md` "Adding a package") is that a new dependency for a package inside the pnpm workspace
goes through that catalog — a root file, owned by PAP-13, out of this issue's paths. `ops/` is also
not one of the workspace globs (see "Tests" above), so there is nowhere inside the workspace to
`pnpm add zod` without a root edit anyway.

[`lib/smoke-config.mjs`](lib/smoke-config.mjs) and [`lib/result-schema.mjs`](lib/result-schema.mjs)
are hand-rolled validators shaped exactly like Zod's `safeParse` —
`{ success: true, data }` or `{ success: false, error: { issues: [{ path, message }] } }` — so that
when PAP-296 (or a later pass here) adds `zod` to the catalog, swapping either module for
`z.object({...}).safeParse` is a same-shape, drop-in change with no call-site edits.

## Follow-ups (not built in this issue)

* `scripts/compose-smoke/budget-table.ts` (sums `ramLoadedMb` under `ops/compose/`, prints headroom
  against the 6 GB budget) — belongs to PAP-296, which reads the result-schema shape documented
  above.
* A dedicated `compose-smoke-warm.yml` on a weekly `schedule:` calling this workflow to pre-warm the
  GHA build cache — natural once a nightly caller (PAP-253) exists to own the schedule.
* Forgejo Actions compatibility (PAP-50): this workflow uses only `actions/checkout`,
  `actions/setup-node`, `actions/cache`, `actions/upload-artifact`, `docker/setup-buildx-action` and
  `docker/bake-action`, all of which Forgejo's action runner can proxy from GitHub's registry, but
  this was not verified against an actual Forgejo runner (none available in this sandbox).
* A GitHub-runner-cap timeout (the job's own 20-minute `timeout-minutes`, distinct from compose's
  600-second `--wait-timeout`) force-cancels the job before any script here can run, so it never
  produces a `status: timeout` result row — only a cancelled job in GitHub's own UI. Worth a
  dedicated "did the runner itself time out" gate reading the workflow run's conclusion, once a
  caller needs to distinguish the two in an automated report.
