# Surfaces: MCP / WebMCP, CLI and API abilities

Every ability the platform exposes to an agent, a script or a caller is recorded here **in the same
pass that adds it**. One row per ability. An ability that is not in this table does not exist as far
as the voice controller, the WebMCP surface and the docs are concerned.

Columns: **Surface** (`MCP`, `WebMCP`, `CLI`, `API`, `Action`), **Ability** (stable id, then one
line of what it does), **Owner issue** (`PAP-<n>`), **Permission** (the permission the caller needs,
or `-`), **Status** (`live`, `stub`, `planned`).

| Surface | Ability | Owner issue | Permission | Status |
| -- | -- | -- | -- | -- |
| CLI | `pnpm check` — lint, typecheck, test and build the whole workspace | PAP-13 | - | live |
| CLI | `pnpm dev` — run `apps/web` on :5173 with hot reload | PAP-13 | - | live |
| CLI | `pnpm build` — build every app; `BASE_PATH` and `VITE_GIT_SHA` are the build inputs | PAP-13 | - | live |
| WebMCP | page actions registry (id, intent phrase, permission) per page | PAP-16 | per action | planned |
| MCP | connector catalog | PAP-210 | per connector | planned |
| CLI | `node ops/ci/compose-smoke/discover.mjs` — finds compose stacks under `ops/compose/**` and `spikes/oss-products/*` that ship a `smoke.json`, prints the CI job matrix | PAP-754 | - | live |
| CLI | `node ops/ci/compose-smoke/probe.mjs --url <url>` — polls a health endpoint until it answers or a timeout elapses | PAP-754 | - | live |
| CLI | `node ops/ci/compose-smoke/validate.mjs --type <smoke\|result> <file>` — validates a `smoke.json` config or a compose-smoke result JSON | PAP-754 | - | live |
| CLI | `node ops/ci/compose-smoke/build-result.mjs` — assembles and validates one stack's result JSON from the workflow's captured numbers | PAP-754 | - | live |
| Action | `compose-smoke` reusable workflow (`workflow_call`/`workflow_dispatch`) — runs every discovered compose stack, captures health and `docker stats`, uploads one result JSON per stack | PAP-754 | `contents: read` | live |
| CLI | `pnpm --filter @paperos/views gen:schemas [-- --check]` — regenerate (or drift-check) the view model JSON Schema files under `packages/views/schema/` | PAP-161 | - | live |
| CLI | `pnpm --filter @paperos/views print-spec <file>` — migrate, strict-parse and JSON-Schema-validate a `ViewSpec` file, printing the parsed spec | PAP-161 | - | live |
| API | `views.*` / `records.*` procedures over `ViewSpec` and `FieldDef` — CRUD arrives with PAP-172 / PAP-613; the model here is their input and output shape | PAP-161 | `view:read`, `view:write` | planned |
| CLI | `commitlint --config ops/forge/commitlint.config.cjs` — enforce the commit grammar (types, scope, `Linear:` / `Character:` / session trailers) | PAP-46 | - | stub (config present, not wired to a hook or CI) |
| CLI | `scripts/worktree.sh new\|done\|list PAP-<n>` — create and retire the per-issue worktree; exit 0 success, 2 refusal | PAP-46 | repo write | planned (contract frozen in `docs/platform/branching-and-commits.md` section 3.1) |
| CLI | `scripts/apply-branch-policy.ts [--dry-run\|--apply\|--print-parity] --repo <slug>` — apply the forge rulesets idempotently | PAP-46 | forge admin | planned (Needs Justin to apply) |
| API | GitHub `POST/PUT /repos/{owner}/{repo}/rulesets`, Forgejo `POST /repos/{owner}/{repo}/branch_protections` and `.../tag_protections` — the endpoints the ruleset JSON is posted to | PAP-46 | forge admin | planned (payloads live in `ops/forge/rulesets/`, manifest `index.json`) |
| CLI | `node scripts/gen-breakpoints.ts [--check]` — regenerate/verify `ops/ci/breakpoints.json` from `packages/core/src/devices/matrix.ts` | PAP-14 | - | stub |
| CLI | `pnpm --filter views parity:report` (`--emit`, `--selftest`) — validate `packages/views/src/parity/checklist.json`, print per-product and per-category view-feature coverage, regenerate the two CSVs under `docs/research/`; exit 1 on any validation error | PAP-162 | - | live |
| CLI | `pnpm bench:crdt [--workload a\|b\|c\|all] [--scale tiny\|default\|full] [--runs N] [--out\|--md <path>]` — run the Yjs/Automerge/Loro CRDT benchmark in `spikes/crdt-bench/`; `pnpm bench` is the CI-scale default (writes `bench/results.json`/`results.md`) | PAP-139 | - | live (spike, never imported by the app) |
| CLI | `pnpm bundle-size` (in `spikes/crdt-bench/`) — gzip size of a minimal esbuild bundle per CRDT library | PAP-139 | - | live (spike) |

The placeholder route declares no actions: it has no controls. The first page with a control adds
its actions registry and its rows here.
