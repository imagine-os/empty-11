# Evidence — PAP-13 (monorepo scaffold)

## Gate

`pnpm i && pnpm check` (`turbo run lint typecheck test build`), cold Turbo cache, Node 22.22.2,
pnpm 10.33.0: **25/25 tasks green in 11.4 s wall** (the Definition of Done allows three minutes on
a GitHub runner). 8 test files, 14 tests, 100 % statement coverage of the scaffold's own source;
`pnpm test:coverage` writes `coverage/` (lcov + json-summary).

## Placeholder route

Built with `VITE_GIT_SHA=479300f`, served from `apps/web/dist`, captured with Playwright Chromium
1.56.1 at the four widths the standard names for a first pass:

| Width | File |
| -- | -- |
| 320 px | [placeholder-320.png](placeholder-320.png) |
| 768 px | [placeholder-768.png](placeholder-768.png) |
| 1280 px | [placeholder-1280.png](placeholder-1280.png) |
| 1920 px | [placeholder-1920.png](placeholder-1920.png) |

The page renders exactly two values — the title (owned by `@paperos/ui`) and the commit SHA — so
nothing has to be translated before the message catalog lands. Landmarks are `banner` and `main`;
the SHA sits in an `output` (`role="status"`); the type scale is `clamp()`-based so it keeps
growing to 3840 px; the SHA chip is 44 px minimum on both axes; `:focus-visible` draws a 3 px ring
for keyboard, remote and gamepad focus. There are no controls yet, so the page declares no actions
in `docs/reference/surfaces.md`.
