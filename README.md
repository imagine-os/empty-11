# paperos-template

[![ci](https://github.com/imagine-os/empty-11/actions/workflows/ci.yml/badge.svg)](https://github.com/imagine-os/empty-11/actions/workflows/ci.yml)

The monorepo every PaperOS app is cloned from: pnpm 10 workspaces, Turborepo 2, strict TypeScript
5.9, Biome 2, Vitest 3, and a Vite 7 + React 19 web shell.

```bash
pnpm i          # Node 22, pnpm 10 (see .nvmrc)
pnpm check      # lint + typecheck + test + build — the whole gate
pnpm dev        # apps/web on http://localhost:5173
```

## Layout

```
apps/web            Vite + React 19 shell (placeholder route today)
apps/desktop        Tauri shell            (stub, PAP-19)
apps/mobile         mobile shell           (stub, PAP-20)
apps/api            oRPC API process       (stub, PAP-267)
packages/core       contract-zero primitives, no React, no database
packages/ui         design-system components
packages/spec       page and app specs
packages/views      view model and compiler
packages/agents     character schema and agent ports
packages/contracts  @paperos/contract-<module>, one folder per module
packages/kernel     registry, DI, gateway, slots   (stub, PAP-434)
packages/config-ts  shared tsconfig presets
packages/config-biome  shared Biome preset
docs/               ADRs, changelog fragments, platform reference, surfaces, evidence
ops/                compose stacks and CI helpers
specs/  spikes/  .claude/
```

Start with [`CLAUDE.md`](CLAUDE.md) for the working rules and [`docs/README.md`](docs/README.md)
for the documentation map. Architecture decisions: [`docs/adr/`](docs/adr/README.md).

## Environment

| Variable | Used by | Default |
| -- | -- | -- |
| `BASE_PATH` | Vite `base` (GitHub Pages sub-path) | `/` |
| `VITE_GIT_SHA` | commit stamped into the bundle | `git rev-parse --short HEAD` |

Copy `.env.example` to `.env` for local overrides; `.env` is git-ignored.

## License

Placeholder, all rights reserved — see [`LICENSE`](LICENSE).
