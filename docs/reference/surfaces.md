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
| CLI | `commitlint --config ops/forge/commitlint.config.cjs` — enforce the commit grammar (types, scope, `Linear:` / `Character:` / session trailers) | PAP-46 | - | stub (config present, not wired to a hook or CI) |
| CLI | `scripts/worktree.sh new\|done\|list PAP-<n>` — create and retire the per-issue worktree; exit 0 success, 2 refusal | PAP-46 | repo write | planned (contract frozen in `docs/platform/branching-and-commits.md` section 3.1) |
| CLI | `scripts/apply-branch-policy.ts [--dry-run\|--apply\|--print-parity] --repo <slug>` — apply the forge rulesets idempotently | PAP-46 | forge admin | planned (Needs Justin to apply) |
| API | GitHub `POST/PUT /repos/{owner}/{repo}/rulesets`, Forgejo `POST /repos/{owner}/{repo}/branch_protections` and `.../tag_protections` — the endpoints the ruleset JSON is posted to | PAP-46 | forge admin | planned (payloads live in `ops/forge/rulesets/`, manifest `index.json`) |
| CLI | `node scripts/gen-breakpoints.ts [--check]` — regenerate/verify `ops/ci/breakpoints.json` from `packages/core/src/devices/matrix.ts` | PAP-14 | - | stub |

The placeholder route declares no actions: it has no controls. The first page with a control adds
its actions registry and its rows here.
