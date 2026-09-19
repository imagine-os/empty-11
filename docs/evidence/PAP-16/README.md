# Evidence — PAP-16 (file-based router with layout slots)

## Gate

`pnpm check` (`turbo run lint typecheck test build`) is green for the three
packages this issue touches (`@paperos/core`, `@paperos/web`, `@paperos/spec`)
— 172 tests total (39 in `@paperos/core`'s `shell/`, 16 in `@paperos/web`,
plus `@paperos/spec`'s own untouched suite), `tsc --noEmit` clean, `biome
check` clean, `vite build` under the round-4 180 KB gzipped budget (121.6 KB).

A repo-wide `pnpm check` also surfaced two pre-existing, unrelated problems,
fixed in passing because they blocked every package's own check, not just
this issue's: `packages/tokens/biome.json` (PAP-66) was missing `"root":
false`, which breaks Biome's config resolution for the *entire* monorepo
(every package's `lint` script, not just tokens'); and `packages/views`
(PAP-161) has one `ajv`-compile test whose 5 s default Vitest timeout is
tight under this build loop's heavy parallel load (times out at N builders
concurrently, passes in under a second alone) — noted under Needs Justin,
not touched, since raising a timeout it doesn't own is out of scope here.

## Screenshots

All at `/dashboard?inspector=open` (nav + sidebar + inspector all filled)
unless noted, captured with Playwright Chromium against `vite build` +
`vite preview`, one browser context per width so viewport and `prefers-color-scheme`
never leak between shots.

| Width | Breakpoint | `data-layout` | File |
| --: | -- | -- | -- |
| 360 px | `xs` | `drawer` | [dashboard-xs-360.png](dashboard-xs-360.png) |
| 390 px | `sm` | `drawer` | [dashboard-sm-390.png](dashboard-sm-390.png) |
| 768 px | `md` | `inspector-drawer` | [dashboard-md-768.png](dashboard-md-768.png) |
| 1280 px | `lg` | `grid` | [dashboard-lg-1280.png](dashboard-lg-1280.png) |
| 1920 px | `xl` | `grid` | [dashboard-xl-1920.png](dashboard-xl-1920.png) |
| 2560 px | `2xl` | `grid` | [dashboard-2xl-2560.png](dashboard-2xl-2560.png) |
| 3840 px | `3xl` | `grid` | [dashboard-3xl-3840.png](dashboard-3xl-3840.png) |

Confirmed via the shell's own `data-sidebar-mode`/`data-inspector-mode`
attributes at capture time: sidebar is a drawer only below `md` (`xs`/`sm`);
inspector is a drawer below `lg` (`xs`/`sm`/`md`); both are persistent grid
columns at `lg` and up — matching `docs/shell/routing.md`'s table exactly.

Other routes, all at `lg` (1280 px):

* [home-lg-1280.png](home-lg-1280.png) — `/`, the public home route (nav only).
* [settings-lg-1280.png](settings-lg-1280.png) — `/settings`, nested under `_app`; exactly one nav bar (the nested-layout-never-double-renders-nav edge case).
* [not-found-lg-1280.png](not-found-lg-1280.png) — an unknown path, the root `notFoundComponent`.
* [error-boundary-lg-1280.png](error-boundary-lg-1280.png) — `/error-demo`, whose loader always throws; the root `errorComponent` with its retry button.
* [dashboard-lg-1280-light.png](dashboard-lg-1280-light.png) / [dashboard-lg-1280-dark.png](dashboard-lg-1280-dark.png) — `prefers-color-scheme: light` / `dark`.

## A bug this evidence pass caught and fixed

The first `xs`/`sm` capture showed the sidebar and inspector drawers
overlapping — interleaved, unreadable text — because their default widths
(`min(280px, 80vw)` + `min(360px, 90vw)`) sum to more than a 360–767 px
viewport when both are open at once. Fixed in `packages/core/src/shell/shell.css`:
below `md`, a drawer is full-width, so an overlap (both open at a narrow
width) is a clean "the later one covers the earlier one" instead of
interleaved text. Re-captured after the fix; the table above reflects the
corrected screenshots.
