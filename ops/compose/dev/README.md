# ops/compose/dev — PaperOS local dev stack (PAP-42)

One disposable backing stack for a laptop or a Claude Code session: Postgres 17 (with the
extensions the schema work needs), ElectricSQL (read-path sync, ADR
[0004](../../../docs/adr/0004-local-first-sync.md)), MinIO (S3-compatible object storage) and
Mailpit (SMTP catcher with a web UI). See "Deviations" below for what the full PAP-42 spec asks for
that this pass does not ship yet.

## Quick start

```bash
ops/compose/dev/bin/up.sh      # start everything, wait for health, print ports + env vars
ops/compose/dev/bin/logs.sh    # tail logs (optionally: logs.sh postgres)
ops/compose/dev/bin/down.sh    # stop; keeps data in named volumes
ops/compose/dev/bin/reset.sh   # stop and delete all data
```

Requires Docker with the Compose plugin (`docker compose version`). No `docker-compose` v1
fallback — this repo targets the plugin.

### Docker missing

`bin/up.sh` prints an install pointer and exits 1 rather than failing silently. Until the full
PAP-42 spec's `PAPEROS_STACK=remote` mode exists (see "Deviations"), a session without Docker
should ask for a shared staging `DATABASE_URL_READONLY` (PAP-30) and skip database-backed tests
with a visible warning, by hand, until that mode is built.

## Ports

| Service | Port(s) | What's there |
| -- | -- | -- |
| postgres | 5432 | Postgres 17 (`pgvector/pgvector:pg17`), db `paperos_dev` |
| electric | 3000 | HTTP: `/v1/health`, shape requests (never expose outside the compose network in a real deployment — ADR 0004) |
| minio | 9000 / 9001 | S3 API / web console |
| mailpit | 1025 / 8025 | SMTP / web UI (also the compose-smoke health endpoint, see `../smoke.json`) |

Fixed ports today (see "Deviations" — per-worktree offsets are a follow-up), so only one worktree
at a time should run `bin/up.sh`; `down.sh`/`reset.sh` are safe from any worktree.

## Roles

Matches PAP-30's role semantics so PAP-34's RLS tests run the same locally as on staging (see
`init/01-roles.sql`):

| Role | Password (dev-only) | Purpose |
| -- | -- | -- |
| `paperos_owner` | `paperos_dev_local` | Bootstrap superuser-equivalent; owns `paperos_dev`; runs migrations (PAP-32). This is the role the build-loop brief that scoped this issue's paths calls "`paperos_admin`" — same role, PAP-30's canonical name is `paperos_owner`. |
| `paperos_app` | `paperos_dev_local` | Application role, `NOBYPASSRLS` — every API query runs as this role once PAP-34 lands. |
| `paperos_readonly` | `paperos_dev_local` | Read-only role. |
| `electric` | `paperos_dev_local` | `REPLICATION` attribute; Electric's own connection (direct, not pooled — ADR 0004). |

All four passwords are fixed, published, local-only values — never reuse them anywhere reachable
outside this compose network.

## Extensions and helpers (`init/`)

Run once, in order, by the official Postgres image's `docker-entrypoint-initdb.d` mechanism (only
on a fresh volume — see `bin/reset.sh` to re-run them):

* `02-extensions.sql` — `vector`, `pg_trgm`, `pgcrypto`, `citext`, `pg_stat_statements` (the
  extensions PAP-30 §Interface Contract and PAP-39 name).
* `03-uuid-v7.sql` — `uuid_generate_v7()` (RFC 9562 UUIDv7, hand-rolled: Postgres 17 has no
  built-in `uuidv7()`) and `set_updated_at()`, the two helpers PAP-32's migration 0000 names.
  PAP-32 is expected to ship the authoritative version in its own migration; this one exists so
  the local stack is useful before PAP-32 lands, and its comment says so.

## Env vars

`bin/up.sh` prints the values to export; `.env.example` in this folder lists them with comments.
Names match the PAP-42 Interface Contract: `DATABASE_URL`, `DATABASE_URL_MIGRATOR`,
`DATABASE_URL_READONLY`, `DATABASE_URL_ELECTRIC`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`,
`S3_BUCKET`, `SMTP_URL`, `ELECTRIC_URL`. `YJS_URL` is reserved but not wired (no Hocuspocus
container yet — see "Deviations").

## compose-smoke (PAP-754)

`smoke.json` beside `compose.yaml` opts this stack into the reusable
[`compose-smoke`](../../ci/compose-smoke/README.md) workflow: `docker compose up --wait`, a
30-second warm-up (Electric and the MinIO bucket-init take longer than Postgres alone), then a
health probe against Mailpit's `/readyz` (chosen because it is the fastest-answering HTTP endpoint
in the stack and proves the compose network itself came up; it does not individually prove
Postgres, Electric or MinIO are healthy — those each have their own Compose `healthcheck:`, which
gates `up --wait`, so a probe that also failed to reach 8025 while the other three passed their own
Docker healthchecks would be surprising and worth a bug report). Validate by hand:

```bash
node ops/ci/compose-smoke/validate.mjs --type smoke ops/compose/dev/smoke.json
docker compose -f ops/compose/dev/compose.yaml config   # parses, no daemon needed
```

### What could not be run in this build sandbox

No Docker daemon is available here (`docker info` cannot reach `/var/run/docker.sock`), so
`docker compose up`, the health probe against a real container, and `docker stats` were not
exercised end to end. Mitigated by: `docker compose config` (works without a daemon) validates the
file parses and resolves cleanly; `node ops/ci/compose-smoke/discover.mjs` confirms this stack is
picked up as a matrix entry with the right `healthcheck`/`warmupSeconds`; the full 38-case
compose-smoke test suite (`node --test ops/ci/compose-smoke/__tests__/*.test.mjs`) still passes
with this stack present. A future session with a real Docker daemon should run
`gh workflow run compose-smoke.yml -f compose-path=ops/compose/dev/compose.yaml` (or
`bin/up.sh` by hand) and attach the result as real integration evidence — see
`docs/platform/dev-stack.md` "Evidence".

## Deviations from the PAP-42 spec text

Recorded here and in the issue's `Session ended` comment. The full PAP-42 Linear spec additionally
asks for, none of which this pass ships:

* **Per-worktree isolation.** A `worktree.ts` slugifier, a `hash(branch) % 50 * 100` port offset,
  per-project-name Docker volumes, and `pnpm stack up|down|reset|logs|prune` so N worktrees run N
  simultaneous stacks without colliding. This pass ships one shared stack on fixed ports instead —
  the build-loop brief that scoped this issue's paths asked for plain shell scripts under `bin/`
  and named the root `pnpm stack *` alias and the per-worktree hashing as a documented follow-up,
  not this pass's work.
* **`.claude/hooks/session-start.sh`.** Not created. Follow-up once the per-worktree scripts above
  exist (a hook that runs `stack up` on a shared, fixed-port stack would make every session fight
  over the same ports).
* **`ci-services.yml` reusable workflow with service containers.** Not created; `compose-smoke`
  (PAP-754) already gives CI one working health-checked stack. A `ci-services.yml` job that starts
  this compose file (rather than GitHub Actions' own `services:` containers) and runs `pnpm test`
  against it is unbuilt — filed as a follow-up.
* **Hocuspocus.** No container. There is no published Hocuspocus Docker image (it is an npm
  library you wrap in your own server); building and maintaining that Dockerfile is out of this
  pass's scope. `YJS_URL` is reserved in `.env.example` but points at nothing real yet.
* **Root `pnpm stack *` alias.** Not added (root `package.json` is PAP-13's file in wave 0). Once
  the per-worktree script package above exists, add `"stack:up": "ops/compose/dev/bin/up.sh"` etc.
  to the root `package.json` scripts.

## Follow-ups (not built in this pass)

* Per-worktree databases, ports and `pnpm stack *` (see "Deviations").
* `.claude/hooks/session-start.sh` running `stack up` + migrations + seeds on session start.
* `ci-services.yml` reusable workflow for Vitest jobs that need Postgres/MinIO/Mailpit as GitHub
  Actions service containers rather than a full compose stack.
* A real Hocuspocus container once a maintained image exists or this repo builds one.
* Fold this folder's `.env.example` into the root one once PAP-17's typed env config lands.
