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
| CLI | `pnpm --filter @paperos/contract-quality calibrate <output.json>` — score a reviewer output against the 15-case calibration set and print the agreement number and the disagreements | PAP-79 | - | live |
| CLI | `pnpm --filter @paperos/contract-quality build:schemas` — regenerate the JSON Schemas in `packages/contracts/quality/schemas/` from the Zod sources | PAP-79 | - | live |
| CLI | `pnpm --filter @paperos/contract-quality build:docs` — regenerate `docs/quality/rubrics/<domain>.md` from `packages/contracts/quality/src/rubrics/<domain>.json` | PAP-79 | - | live |
| CLI | `pnpm --filter views parity:report` (`--emit`, `--selftest`) — validate `packages/views/src/parity/checklist.json`, print per-product and per-category view-feature coverage, regenerate the two CSVs under `docs/research/`; exit 1 on any validation error | PAP-162 | - | live |
| CLI | `pnpm --filter @paperos/core example:filter` — print a `FilterTree`, its SQL, its English and Spanish explanation and its URL form (`@paperos/core/filter`, PAP-279) | PAP-279 | - | live |
| CLI | `pnpm --filter @paperos/agents validate [dir\|file ...]` — validate roster YAML against the character schema, registry and graph rules; exit 0 ok, 1 errors, 2 usage; `--json`, `--quiet` | PAP-103 | - | live |
| CLI | `pnpm --filter @paperos/agents gen:schemas [--check]` — regenerate `packages/agents/schema/*.schema.json`; `--check` fails on drift | PAP-103 | - | live |
| CLI | `pnpm --filter @paperos/agents gen:fixtures [--check]` — resolve the golden roster into `fixtures/valid/roster.json` | PAP-103 | - | live |
| CLI | `pnpm --filter @paperos/agents convert:plan [--check]` — dry-run conversion of plan.json `agents[]` into character skeletons | PAP-103 | - | live |
| API | `@paperos/agents/schema` — `CharacterSchema`, `RosterSchema`, `validateRoster`, `resolveInheritance`, `SCOPES`, `KNOWN_TOOLS`, JSON Schema generators | PAP-103 | - | live |
| Action | actions registry — every page declares its actions as `{ id, titleKey, intent: { en, es }, permission, scope, shortcut, modalities, agentCallable, placeholder, argsSchema }`; the declaration is the WebMCP tool surface, the voice controller's vocabulary and the command palette's source (schema: `packages/input/src/schema/action.schema.json`, registry file: `action-registry.schema.json`) | PAP-150 | per action (`permission`, or `-`) | live (shape frozen; pages register through PAP-151) |
| WebMCP | `agentCallable` actions are exposed as tools, gated by the action's `permission`; arguments validated against `argsSchema` | PAP-150 | per action | planned (endpoint is PAP-291) |
| CLI | `pnpm --filter @paperos/input gen:schemas` — regenerate the input JSON Schema files from the Zod 4 schemas | PAP-150 | - | live |
| CLI | `pnpm --filter @paperos/input gen:fixtures` — regenerate the golden normalised event stream | PAP-150 | - | live |
| CLI | `node scripts/security-controls.ts --check` — validate `ops/security/controls.yaml`, `agent-deny.yaml` and `headers.json` (ids, boundaries, manual cadences, S0 backstops, no relaxed app CSP, HSTS preload minimum, credentialed CORS never `*`); exit 1 on any problem | PAP-219 | - | live |
| CLI | `node scripts/security-controls.ts --verify lint\|test\|scan\|manual` — list the controls a given check mode is responsible for, with boundary and status | PAP-219 | - | live |
| CLI | `node scripts/security-controls.ts --boundary B<n>` / `--summary` — list one trust boundary's controls, or counts per boundary | PAP-219 | - | live |
| API | `POST /api/v1/security/csp-report` — CSP violation report sink (`report-to paperos-csp`), rate limited 30/min/IP and sampled | PAP-219 | - | planned (profile in `ops/security/headers.json`; route lands with `apps/api`) |
| API | `securityHeaders({ profile })` — the baseline header and CSP middleware contract every surface calls; `CSP_NONCE` request-context key | PAP-219 | - | planned (contract frozen in `docs/security/hardening-baseline.md` section 13; Forge implements) |
| CLI | `pnpm --filter @paperos/core run events:catalogue [-- --check]` — regenerate `docs/platform/events.md` from the topic registry; `--check` fails on drift and runs as part of `lint` | PAP-555 | repo write | live |
| CLI | `pnpm --filter @paperos/db run events:example` — the transactional-outbox demo on in-process Postgres (also `pnpm dlx tsx examples/events.ts`) | PAP-555 | - | live |
| API | `publish(tx, event)` from `@paperos/core/events` — write one domain event to the outbox inside the caller's transaction | PAP-555 | caller's own | live |
| API | `on(topic, handler, { name, idempotent })` and `drainInProcess(tx)` — register an in-process subscriber and deliver after commit (the job dispatcher is PAP-556) | PAP-555 | - | live |
| API | `defineTopic(name, payloadSchema, options)` / `topics()` — register a topic at import time and read the registry | PAP-555 | - | live |
| CLI | `pnpm --filter @paperos/tokens build` / `build:check` — compile DTCG token JSON to `tokens.css`, `theme.css`, `tokens.ts`, `raw-tokens.json`; `--check` diffs against committed output for CI drift detection | PAP-66 | - | live |
| CLI | `pnpm --filter @paperos/tokens ramps` — regenerate one colour ramp's OKLCH steps with `culori`, print DTCG JSON to stdout for hand-review before pasting into `core.tokens.json` | PAP-66 | - | live |
| CLI | `pnpm --filter @paperos/tokens tokens:lint` — DTCG schema (kebab names), alias resolvability, cycle detection, unused alias-only primitives | PAP-66 | - | live |
| CLI | `pnpm --filter @paperos/tokens tokens:check` — WCAG contrast assertions (`fg.default` 4.5:1, `fg.muted` 3:1, status and on-accent pairs) across light/dark/hc; `--report <path>` writes the JSON the evidence swatch page reads | PAP-66 | - | live |

The placeholder route declares no actions: it has no controls. The first page with a control adds
its actions registry and its rows here; the shape it declares against is the `Action` row above
(PAP-150, [`docs/platform/input-events.md`](../platform/input-events.md) section 5).
| CLI | `pnpm --filter @paperos/spec gen:schemas` — regenerate `packages/spec/schema/page.spec.schema.json` and `docs/platform/page-spec.md` from the Zod schema; `gen:schemas:check` exits 1 when stale (drift test also runs in `pnpm test`) | PAP-114 | - | live |
| CLI | `pnpm --filter @paperos/spec parse <file.spec.yaml>` — parse and validate one page spec, print every issue with code, path, line:col and hint; exit 0 clean, 1 errors, 2 usage. Smoke tool; PAP-115 ships `paperos-spec validate` | PAP-114 | - | stub (one-file demo CLI) |
| API | `@paperos/spec`: `parseSpec(yaml, { filename?, knownRoutes? })`, `validatePageSpec(object)`, `PageSpecSchema`, `pageActions(spec)`, `notWiredComponents(spec)`, `migrateSpec(doc)`, `buildPageJsonSchema()` | PAP-114 | - | live |
| Action | `logic.actions.<id>` in every `specs/pages/<page>.spec.yaml` — the per-page actions registry (`intent` message key, `permission`, `input`, `status`); `pageActions()` flattens to `<page>.<action>` for the WebMCP surface and the voice controller | PAP-114 | per action (`permission`) | live (schema); consumers PAP-16 / WebMCP planned |

The placeholder route declares no actions: it has no controls. Page actions are declared in the page
specs (`logic.actions`, PAP-114): `specs/pages/customer-invoices.spec.yaml` declares `openInvoice`,
`payInvoice`, `downloadPdf` (not wired), `retryLoad`; `specs/pages/staff-settings.spec.yaml` declares
`inviteMember`, `changeRole`, `removeMember`, `saveBranding` (not wired), `toggleModule`, `retryLoad`.
They become live WebMCP abilities when PAP-16 mounts the registry.
