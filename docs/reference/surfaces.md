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
| MCP | connector catalog — `.claude/mcp/catalog.json`: 11 servers, every tool scope-classed, auth as `broker:<service>/<credential>` placeholders, owner and rubric score per server | PAP-210 | per server, per character | live |
| MCP | `mcp__<server>__<tool>` — the tool-name grammar PAP-106 allowlists and PAP-711's hook match on; built by `qualifiedToolName()` in `@paperos/agents/mcp` | PAP-210 | per tool scope class | live |
| MCP | per-character bundles `.claude/agents/<character>/mcp.json` — a Claude Code `.mcp.json` body per lead; read-only endpoints for every character outside a server's `writeCharacters` | PAP-210 | character bundle | live (stubs; PAP-106 generates them) |
| CLI | `pnpm --filter @paperos/agents mcp:check` — validate the catalogue and the nine fragments: schema, allowlists, destructive-tool removal, secret scan, rubric totals. Exit 0 ok, 1 drift | PAP-210 | - | live |
| CLI | `pnpm mcp check` — probe each stdio server and each remote endpoint, diff the live `tools/list` against the catalogue, report missing broker placeholders. Exit 0 ok or skipped, 1 drift, 2 missing required credential | PAP-210 | broker access | planned (static checker is live; network probe is a follow-up) |
| API | `validateCatalog(catalog, fragments)` / `effectiveToolsFor(server, character)` from `@paperos/agents/mcp` — the tool list a character may be granted, and the findings that fail the gate | PAP-210 | - | live |
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
| CLI | `pnpm --filter @paperos/contract-quality calibrate <output.json>` — score a reviewer output against the 15-case calibration set and print the agreement number and the disagreements | PAP-79 | - | live |
| CLI | `pnpm --filter @paperos/contract-quality build:schemas` — regenerate the JSON Schemas in `packages/contracts/quality/schemas/` from the Zod sources | PAP-79 | - | live |
| CLI | `pnpm --filter @paperos/contract-quality build:docs` — regenerate `docs/quality/rubrics/<domain>.md` from `packages/contracts/quality/src/rubrics/<domain>.json` | PAP-79 | - | live |
| CLI | `pnpm --filter views parity:report` (`--emit`, `--selftest`) — validate `packages/views/src/parity/checklist.json`, print per-product and per-category view-feature coverage, regenerate the two CSVs under `docs/research/`; exit 1 on any validation error | PAP-162 | - | live |
| CLI | `pnpm --filter @paperos/core example:filter` — print a `FilterTree`, its SQL, its English and Spanish explanation and its URL form (`@paperos/core/filter`, PAP-279) | PAP-279 | - | live |

The placeholder route declares no actions: it has no controls. The first page with a control adds
its actions registry and its rows here.
