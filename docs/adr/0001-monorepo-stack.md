# 0001. Monorepo stack

* Status: Accepted
* Date: 2026-09-19
* Issue: [PAP-13](https://linear.app/paperos/issue/PAP-13)
* Deciders: Forge (build), Sentinel (review)

## Context

`paperos-template` is the repository every PaperOS app is cloned from, and the repository sixteen
parallel builder sessions land their first issues in on day one. It has to satisfy four things at
once: one command that lints, typechecks, tests and builds from a clean clone in under three
minutes; a package layout that matches Interface & Data Contracts §5 and the Module System
(`packages/contracts/*`, `packages/kernel`, module manifests); a web app that runs on React 19;
and generic enough wiring that a later issue can add a package without editing a root file.

Everything downstream imports the names chosen here (`@paperos/core`, `@paperos/ui`,
`@paperos/spec`, `@paperos/views`, `@paperos/agents`, `@paperos/config-ts`, `@paperos/config-biome`),
so renaming any of them later is a breaking change that needs its own ADR.

## Decision

| Concern | Choice | Version pinned at scaffold |
| -- | -- | -- |
| Package manager | pnpm workspaces, with a `catalog:` for every shared version | pnpm 10.33.0 |
| Task runner | Turborepo, remote cache off | 2.11.2 |
| Language | TypeScript, `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `moduleResolution: bundler` | 5.9.3 |
| Web app | Vite + `@vitejs/plugin-react`, React 19, build target `es2022` | Vite 7.3.6, plugin-react 5.2.0, React 19.3.0 |
| Tests | Vitest, jsdom + Testing Library for React, `passWithNoTests` per package, coverage to `coverage/` | Vitest 3.2.7 |
| Lint + format | Biome (one tool for both), preset in `@paperos/config-biome` | 2.5.14 |
| Runtime | Node 22 LTS, pinned by `.nvmrc`, `engines` and `engine-strict=true` | 22 |
| CI | GitHub Actions, job `ci / check` running `pnpm turbo lint typecheck test build` | — |

Resolution between packages is by workspace link: every package's `exports` points at
`src/index.ts`, so there is no build step between packages and no `dist` to stale. TypeScript path
aliases `@paperos/*` → `packages/*/src` and `@paperos/contract-*` → `packages/contracts/*/src` are
declared as wildcards, which means a new package needs no root edit.

Versions are named on the major line the plan fixed (TypeScript 5.9, Vite 7, Vitest 3, Turborepo 2,
Biome 2), at the newest patch available on 2026-09-19.

## Consequences

* `pnpm i && pnpm check` is the only command a contributor or a gate has to know.
* Adding a package is: create the folder, copy a sibling's `package.json`, `tsconfig.json` and
  `vitest.config.ts`. No root file changes, so parallel sessions do not collide on the root.
* Shared versions move in one place (`pnpm-workspace.yaml` `catalog:`); a package that wants a
  different version has to say so explicitly, which shows up in review.
* No package build step means `dist/**` only exists for `apps/web`; a future published package
  will need `tsdown`/`tsc` and a `publishConfig` exports swap.
* Biome replaces ESLint + Prettier: fewer dependencies and a much faster lint, at the cost of a
  smaller rule ecosystem. The module-boundary rules (R7-R11) will need dependency-cruiser
  (PAP-305), which Biome cannot express.

## Alternatives rejected

* **Nx instead of Turborepo** — richer generators and a graph UI, but a heavier config surface and
  a plugin per tool. Turbo's `tasks` map is small enough to read in one screen, which matters when
  sixteen sessions edit around it.
* **npm or Yarn workspaces** — no `catalog:`, slower installs, and pnpm's strict `node_modules`
  is what makes the module-boundary rule enforceable at install time rather than only in lint.
* **ESLint + Prettier + `eslint-plugin-import`** — the known quantity, and it can express import
  cycles today. Rejected for speed and for the three-tool config sprawl; cycles and boundaries are
  handled by dependency-cruiser (PAP-305) instead, which is stricter than the ESLint rule anyway.
* **Jest** — slower, and a second transform pipeline next to Vite's. Vitest reuses `vite.config.ts`.
* **TypeScript project references with per-package `dist`** — correct for publishing, but it adds a
  build step between every package and a class of stale-`dist` bugs. Source `exports` are simpler
  while nothing is published; revisit when the first package goes to a registry.
* **TypeScript 7 / Vite 8 / Vitest 5 (the newest majors on the registry)** — rejected for this
  scaffold: the plan pins the 5.9 / 7 / 3 lines and fifteen other sessions build against them the
  same day. Upgrading is a follow-up issue with its own ADR, not a surprise on day one.
* **Remote caching (Vercel)** — off by default; it needs an account and a token, and the build is
  under three minutes cold. Revisit when CI time hurts.
