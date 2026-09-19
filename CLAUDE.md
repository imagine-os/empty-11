# CLAUDE.md — working rules for `paperos-template`

Read this before touching anything. It is short on purpose; every rule here is enforced by a gate
or by review.

## Commands

| Command | Does |
| -- | -- |
| `pnpm i` | install (Node 22, pnpm 10; `engine-strict` fails a wrong Node loudly) |
| `pnpm check` | **the gate**: `turbo run lint typecheck test build`. Green before every push. |
| `pnpm dev` | `apps/web` on http://localhost:5173, hot-reloading every workspace package |
| `pnpm lint` / `pnpm lint:fix` | Biome check / write |
| `pnpm typecheck` | `tsc --noEmit` per package |
| `pnpm test` / `pnpm test:watch` / `pnpm test:coverage` | Vitest; coverage lands in `coverage/` |
| `pnpm build` | Turborepo build; `apps/web` emits `dist/` |
| `pnpm clean` | remove `dist`, `coverage`, `.vite` |

Scope one package with `pnpm --filter @paperos/<name> <script>`.

## Folder map

```
apps/web              Vite 7 + React 19 shell. Placeholder route today; router is PAP-16.
apps/desktop          Tauri shell (stub, PAP-19)
apps/mobile           Mobile shell (stub, PAP-20)
apps/api              oRPC API process (stub, PAP-267)
packages/core         Contract-zero primitives. Pure TS: no React, no DB, no env reads.
                      `src/index.ts` is owned by app-shell — see packages/core/README.md.
packages/ui           Design-system components (PAP-66 onwards)
packages/spec         Page and app spec schemas (PAP-114 onwards)
packages/views        View model, compiler, field types (PAP-161 onwards)
packages/agents       Character schema, handoff, agent ports (PAP-103)
packages/contracts/*  `@paperos/contract-<module>` — one per module. Types, Zod schemas, event
                      topics, route signatures, slot definitions, ports, conformance. No runtime.
packages/kernel       Registry, DI, gateway, UI slots, swap CLI (stub, PAP-434)
packages/config-ts    tsconfig presets: base.json, react.json, node.json
packages/config-biome Biome preset
docs/                 See docs/README.md — the start-here map
ops/compose, ops/ci   Compose stacks, CI helpers
specs/                Page specs (spec-builder)
spikes/               Throwaway experiments, never imported
.claude/              Agent definitions, skills, rules (see .claude/CLAUDE.md)
```

## Adding a package (no root edit needed)

Workspace globs (`apps/*`, `packages/*`, `packages/contracts/*`) and the aliases
`@paperos/*` → `packages/*/src`, `@paperos/contract-*` → `packages/contracts/*/src` are wildcards.
Copy a sibling's `package.json`, `tsconfig.json` and `vitest.config.ts`, change the name, add one
test. Do not edit `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `biome.json`, `tsconfig.json`
or the CI workflow at the root unless the change genuinely belongs to every package — those files
have one owner and parallel sessions collide on them.

Shared dependency versions live in the `catalog:` block of `pnpm-workspace.yaml`. Use
`"vitest": "catalog:"`, not a literal version.

## Module boundary

A module imports `@paperos/core`, any `@paperos/contract-*`, and its own package. Nothing else.
Never import another module's implementation package, table, component or env var — reach it
through the kernel (registry, DI, event bus, gateway, UI slots). Declare what you provide and
require in the module manifest; bump the contract version on any shape change.

## Never edit generated files

Anything a generator writes is owned by the generator, not by you. Today that is
`pnpm-lock.yaml` (change it by running pnpm), `CHANGELOG.md` (assembled from fragments), and —
as they land — `docs/platform/dependency-map.json`, `docs/platform/compat-matrix.*`,
`packages/core/src/modules/manifest.schema.json`, and every `module.manifest.json`. Generated files
carry a header saying so and CI fails when a committed copy is stale. Fix the generator or its
input, then re-run it.

## Changelog fragments

Never edit `CHANGELOG.md`. Add `docs/changelog/unreleased/PAP-<n>.md`, two to six lines: what
landed, the paths, the ADR. Convention and template:
[`docs/changelog/unreleased/README.md`](docs/changelog/unreleased/README.md).

## ADRs

Decisions go in `docs/adr/<nnnn>-<slug>.md`, Nygard style, numbers pre-assigned by the plan.
The register is [`docs/adr/README.md`](docs/adr/README.md) — take your number from it and add your
row. ADRs are append-only: supersede, never rewrite.

## Docs land in the same pass as the work

A change is not done until the repo says so: the changelog fragment, the ADR if there was a
decision, the page doc, and a row in [`docs/reference/surfaces.md`](docs/reference/surfaces.md) for
every MCP / WebMCP / CLI / API ability the change adds. Evidence (screenshots, gate artefacts) goes
in `docs/evidence/PAP-<n>/`.

## Standards every page and package meets

* **Responsive 360 → 3840.** Check 360, 390, 768, 1280, 1920, 2560 and 3840 px. Large screens are
  read from ten feet away *and* used as desk monitors: type and targets scale, they do not just
  stretch.
* **Every input.** Keyboard, mouse, trackpad, touch and pen today; TV remote / gamepad d-pad and
  voice next. Sensible focus order, always-visible focus rings, 44 px minimum targets, and nothing
  that only works on hover or only by dragging.
* **English and Spanish from the start.** No hard-coded user-visible strings; text comes from the
  message catalog. Spanish fill is a pass, never a blocker.
* **Placeholders are marked.** Any control that is not wired yet shows a tooltip and a
  "not wired yet" toast on activation, and is always visibly marked in dev mode. Silent dead
  buttons are a bug.
* **Every page declares its actions.** An actions registry entry per action (`id`, intent phrase,
  permission). It is the WebMCP surface and the voice controller's vocabulary, so a UI change that
  adds, renames or removes a control updates the registry in the same commit.
* **Multiplayer-ready data.** Every record carries a UUIDv7 `id` and an `updated_at`; state comes
  from a provider, never from module-local mutable state. Realtime, presence and offline arrive
  later, but the ids and timestamps are there from day one.
* **Accessibility is not a pass.** Semantic landmarks, real headings, labelled controls, contrast,
  `prefers-reduced-motion`.

## Git

Conventional commits scoped by issue: `feat(PAP-13): scaffold monorepo`. Small, validated commits;
`pnpm check` green before every push. No force-push to `main`.
