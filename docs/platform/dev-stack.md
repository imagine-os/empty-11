# Local dev stack (PAP-42)

One disposable backing stack — Postgres 17, ElectricSQL, MinIO and Mailpit — so a laptop, a CI job
and a Claude Code session all run against the same thing. Files live in
[`ops/compose/dev/`](../../ops/compose/dev/README.md); this page is the platform-reference summary
the [`docs/platform/README.md`](README.md) index points to. Read `ops/compose/dev/README.md` for
the day-to-day commands, ports, roles and env var table — it is not duplicated here.

## Why

Schema work (PAP-32, blocked by this issue) and every later data-layer/app-shell issue need a real
Postgres 17 with the right extensions, plus the read-path sync engine (ADR
[0004](../adr/0004-local-first-sync.md)) and object storage, before any of them can be built or
tested. Without one shared, disposable definition, every session would hand-roll its own container
and drift.

## What this pass ships

* `ops/compose/dev/compose.yaml` — `postgres` (`pgvector/pgvector:pg17`, `wal_level=logical`, the
  extensions PAP-30/PAP-39 name pre-installed), `electric` (`electricsql/electric:1.8.1`, ADR
  0004), `minio` (+ a one-shot `minio-init` bucket creator), `mailpit`. Every service has a Docker
  `healthcheck` and Postgres/MinIO use named volumes.
* `ops/compose/dev/init/*.sql` — roles (`paperos_app`, `paperos_readonly`, `electric`; `paperos_owner`
  comes from the image's own bootstrap user), the extensions, and `uuid_generate_v7()` /
  `set_updated_at()` — the two helpers PAP-32's migration 0000 names, so the stack is useful before
  PAP-32 lands.
* `ops/compose/dev/bin/{up,down,reset,logs}.sh` — plain shell wrappers (see "Deviations" for why
  this is shell, not a `pnpm stack` script package).
* `ops/compose/dev/smoke.json` — opts this stack into the reusable `compose-smoke` workflow (PAP-754,
  ADR 0025); see `ops/compose/dev/README.md` "compose-smoke".
* `ops/compose/dev/.env.example` — the env var names and values `bin/up.sh` prints.

## Deviations from the PAP-42 spec text

The full Linear PAP-42 spec asks for substantially more than this pass builds; the build-loop
coordinating session that scoped this issue's file paths narrowed it to the list above. In full,
not shipped in this pass:

1. **Per-worktree isolation.** `worktree.ts` (slugify the branch, `hash(branch) % 50 * 100` port
   offset), a distinct Compose project name and volume set per worktree, and `pnpm stack
   up|down|reset|logs|prune` — so N worktrees run N simultaneous, non-colliding stacks. This pass
   ships one shared stack on fixed ports (5432, 3000, 9000/9001, 1025/8025); only one worktree at a
   time should run `bin/up.sh`.
2. **`.claude/hooks/session-start.sh`.** Not created — see (1): a hook that starts a shared,
   fixed-port stack on every session start would make sessions fight over ports rather than never
   collide, which is the opposite of the issue's own goal statement.
3. **`ci-services.yml` reusable workflow with service containers.** Not created. PAP-754's
   `compose-smoke` workflow already exercises this stack in CI (health + `docker stats`); a second
   workflow that runs `pnpm test` against these services as GitHub Actions `services:` containers
   is a distinct, unbuilt follow-up.
4. **Hocuspocus.** No container ships. There is no published Hocuspocus Docker image — it is an
   npm library (`@hocuspocus/server`) meant to be wrapped in your own Node server — so adding it
   here would mean authoring and maintaining a Dockerfile, out of this pass's scope. `YJS_URL` is
   reserved in `.env.example` but is not wired to anything.
5. **Root `pnpm stack *` alias and root `.env.example`.** Not added; the root `package.json` and
   `.env.example` are PAP-13's files in wave 0 (see the repo's `CLAUDE.md` "Touch only your
   paths"). `ops/compose/dev/.env.example` documents the same vars for now.

Each is filed as a follow-up (see below) rather than built here, to keep this pass inside its
"Infra S" sizing.

## Evidence

* `docker compose -f ops/compose/dev/compose.yaml config` — parses and resolves cleanly (works
  without a Docker daemon; ran in this build sandbox, which has no daemon).
* `node ops/ci/compose-smoke/discover.mjs` — lists `ops-compose-dev` in the matrix with
  `healthcheck: http://localhost:8025/readyz`, `warmupSeconds: 30`.
* `node --test ops/ci/compose-smoke/__tests__/*.test.mjs` — all 38 cases still pass with this stack
  present.
* No Docker daemon is available in this build sandbox (`docker info` cannot reach the socket), so
  `docker compose up`, a live health probe and `docker stats` were not exercised end to end — see
  `ops/compose/dev/README.md` "What could not be run in this build sandbox" for the full mitigation
  and the follow-up command a session with a real daemon should run.

## Follow-ups (not built in this pass)

* Per-worktree databases, ports and `pnpm stack *` script package (deviation 1).
* `.claude/hooks/session-start.sh` (deviation 2), once (1) exists.
* `ci-services.yml` reusable workflow (deviation 3).
* A real Hocuspocus container (deviation 4), once a maintained image exists or one is built here.
* Fold `ops/compose/dev/.env.example` into the root `.env.example`/`.env.local` once PAP-17's typed
  env config lands (deviation 5).
* Run `docker compose -f ops/compose/dev/compose.yaml up --wait` on a machine with a Docker daemon
  and attach the transcript as the first real integration evidence (see "Evidence").
