# 0025. Compose-smoke workflow

* Status: Accepted
* Date: 2026-09-19
* Issue: [PAP-754](https://linear.app/paperos/issue/PAP-754)
* Deciders: Forge (build), Sentinel (review, secrets handling)

## Context

Seven issues (PAP-214, PAP-215 and its six children — the OSS-product spikes: NocoDB, Baserow,
Plane, Twenty, Chatwoot, Listmonk, Postiz, Cal.com, Formbricks) all assert in their Definition of
done that a `compose-smoke` CI job starts the candidate with `docker compose up --wait` and
captures `docker stats`, so their scorecards report numbers the same way and PAP-296's resource
budget table is generated rather than typed in by hand. None of them builds that job; this issue
ships it first, standalone, so the spikes (and the PAP-42 dev stack, using the same grammar) adopt
one workflow instead of six copies.

The workflow has to run with no fixed catalog of compose files (spikes and dev-stack services land
over the following weeks), no daemon in the build sandbox to test against end to end, and no new
root-level dependency (this repo's convention reserves `pnpm-workspace.yaml`'s `catalog:` for
PAP-13; see `CLAUDE.md` "Adding a package").

## Decision

| Concern | Choice |
| -- | -- |
| Discovery | A `discover` job walks `ops/compose/**/compose.yaml` (recursive) and `spikes/oss-products/*/compose.yaml` (one level), builds a `fromJson()` matrix, and hands it to a `smoke` job via `needs.discover.outputs.matrix`. |
| Per-stack config | A sidecar `smoke.json` beside each `compose.yaml` (`healthcheck`, `warmupSeconds`, `load`, `ramBudgetMb`, `skipCi`) — **not** the spec's `x-paperos` compose extension field; see "Alternatives rejected". A compose file with no `smoke.json` is skipped, not an error, so today's stub `ops/compose/` folders do not fail the workflow. |
| Health gate | `docker compose up -d --wait --wait-timeout 600`, then a `warmupSeconds` sleep, then `probe.mjs` polls `smoke.json`'s `healthcheck` URL (any response under 500 counts as healthy) until it answers or a 60-second probe timeout elapses. |
| Resource capture | `docker stats --no-stream --format '{{json .}}'` once right after `up --wait` (idle) and again after warm-up/load (loaded); `docker image inspect --format '{{.Size}}'` summed across the stack's images. Parsed by `parse-docker-stats.mjs`. |
| Image cache | `docker/setup-buildx-action` + `docker/bake-action` reading the compose file directly (bake treats each service as a build target), with `cache-from`/`cache-to type=gha`. Chosen over the spec's `docker/build-push-action` — see "Alternatives rejected". |
| Time cap | `timeout-minutes: 20` on the `smoke` job (the spec's cap); a `discover`-level timeout of 5 minutes keeps a broken glob from hanging the whole workflow. |
| Result schema | `{ name, startedMs, healthy, ramIdleMb, ramLoadedMb, cpuPct, imageSizeMb, status }`, `status` one of `ok / unhealthy / timeout / skipped`, validated by a hand-rolled, Zod-`safeParse`-shaped validator (`lib/result-schema.mjs`) instead of real `zod` — see "Alternatives rejected". |
| Concurrency | One group per workflow ref (`compose-smoke-${{ github.ref }}`), `cancel-in-progress: true`, so a new push supersedes an in-flight run instead of queuing behind it. |
| Secrets | Out of scope for this issue: any stack whose `smoke.json` sets `skipCi` is excluded from the matrix and logged; running it against a real credential (PAP-300's broker, nightly on staging) is the calling issue's job, not this workflow's. |
| Triggers | `workflow_call` (any caller job — the spike issues, PAP-253 nightly) and `workflow_dispatch` with an optional `compose-path` input to run one stack for a fast manual demo. |

## Consequences

* A spike issue (PAP-295/296/350/351/352 and the PAP-215 children) that ships a compose stack only
  has to add a `smoke.json` beside it; no workflow edit, no root-file edit.
* `ops/compose/` folders that are still stubs (no compose file, or a compose file with no
  `smoke.json` yet) never fail the workflow — they are silently absent from the matrix, logged at
  `discover` time.
* The result JSON's shape is fixed today by a hand-rolled validator, not `zod`; PAP-296's
  budget-table script (out of this issue's paths — see `ops/ci/compose-smoke/README.md`
  "Follow-ups") can either keep using that validator's shape or migrate both to real `zod` once it
  is worth a `pnpm-workspace.yaml` catalog edit.
* The workflow's own 20-minute job cap and `docker compose up --wait --wait-timeout 600`'s 600-second
  wait are two different timeouts: the compose-level one produces a `status: timeout` result row
  with a log tail; the runner-level one force-cancels the job before any script here runs, and shows
  as a cancelled job in GitHub's UI with no result artefact for that entry. Documented, not solved,
  in this issue — see `ops/ci/compose-smoke/README.md` "Follow-ups".
* Nothing in this workflow or its scripts was run against a real Docker daemon (none in the build
  sandbox); see `ops/ci/compose-smoke/README.md` "What could not be run" for what stood in for that
  (schema validation of the YAML, unit tests of every script's pure logic, a captured CLI transcript
  of the probe's timeout path).

## Alternatives rejected

* **`x-paperos` extension field inside `compose.yaml`** (the spec's literal grammar) — rejected for
  this pass: `discover.mjs` would need a YAML parser to read it, which means either a new
  `pnpm-workspace.yaml` catalog dependency (root file, PAP-13's, out of this issue's paths) or a
  hand-rolled YAML subset parser for no benefit over a sidecar JSON file `JSON.parse` already
  handles correctly. Same field names and defaults; only the file changed. A later pass can move the
  fields into the compose file itself once a YAML dependency is already in the catalog for another
  reason.
* **`docker/build-push-action` per service** (the spec's literal image-cache tool) — rejected:
  `build-push-action` builds one image at a time, so a multi-service stack would need one step per
  service, generated dynamically from the compose file's service list. `docker/bake-action` reads
  the compose file directly and treats every service as a bake target in one step, with the same
  `cache-from`/`cache-to: type=gha` cache. Functionally equivalent goal (a warm image cache keeping
  a 2 GB image inside the 20-minute cap), smaller workflow.
* **Real `zod` for the result/config schemas** — rejected for this pass; see "Why not zod" in
  `ops/ci/compose-smoke/README.md`. The hand-rolled validators are shaped like `safeParse` so the
  swap is mechanical later.
* **A separate workflow per glob** (one for `ops/compose/**`, one for `spikes/oss-products/*`) —
  rejected: both produce the same result shape and share every script; one `discover` job merging
  both globs into one matrix is simpler for a caller to depend on (`compose-smoke` is one job name,
  not two).
* **Parsing exposed ports for a default healthcheck** (the spec's "missing fields default to the
  first exposed port") — rejected: it needs the same YAML parsing this ADR already avoids, and a
  default guessed from ports cannot know whether a service speaks HTTP at all (Postgres does not).
  `healthcheck` is required in `smoke.json` instead, and `ops/compose/example-postgres/` documents
  the one-line workaround (a tiny HTTP sidecar) for a stack that has no HTTP surface of its own.
