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

The placeholder route declares no actions: it has no controls. The first page with a control adds
its actions registry and its rows here.
