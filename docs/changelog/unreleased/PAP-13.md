### Added — PAP-13: monorepo scaffold

- pnpm 10 workspace + Turborepo 2 with `lint`, `typecheck`, `test`, `build`, `dev`, `clean`, and
  `pnpm check` running all four gates; Node 22 pinned; Biome 2 and Vitest 3 wired.
- `apps/web`: Vite 7 + React 19 placeholder route rendering the template title and `VITE_GIT_SHA`,
  responsive 360-3840 px with visible focus and 44 px targets.
- Wired-but-empty packages `@paperos/{core,ui,spec,views,agents,config-ts,config-biome}`, stub
  folders for `packages/contracts`, `packages/kernel`, `apps/{desktop,mobile,api}`, `docs/`,
  `ops/`, `specs/`, `spikes/`, `.claude/`, and CI job `ci / check`.
- ADR: [0001-monorepo-stack](../../adr/0001-monorepo-stack.md)
