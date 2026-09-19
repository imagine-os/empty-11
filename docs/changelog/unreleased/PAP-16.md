### Added — PAP-16: file-based router with layout slots

- TanStack Router 1.x (Vite plugin) with `<AppShell>` (nav/sidebar/main/inspector/commandbar/statusbar
  slots), the slot registry, `useLayout`/`useSpecLayout`/`useSpec`/`useShellSearch`, the actions
  registry and dev-mode "not wired yet" marking, all at `@paperos/core/shell` (React-in-`packages/core`
  exception, documented in its README). Three example routes (`/`, `/dashboard`, `/settings`) driven
  by real `@paperos/spec` (PAP-114) page specs; a fourth, `/error-demo`, exercises the error boundary.
- Paths: `packages/core/src/shell/**`, `apps/web/src/routes/**`, `apps/web/src/{components,i18n,specs,shell,type-tests}/**`,
  `apps/web/{router.ts,vite-plugin-paperos-specs.ts,biome.json}`, `specs/pages/{home,dashboard,settings}.spec.yaml`,
  `docs/shell/routing.md`. Also fixed `packages/tokens/biome.json` (missing `"root": false`, broke
  every package's `biome check`) in passing.
- No ADR: no number is pre-assigned for this issue and no new architectural decision was made
  (the router/shell choices are the issue's own spec).
