# Evidence — PAP-305 (package boundary map)

| File | Shows |
| -- | -- |
| [`lint-deps-green-1280.svg`](lint-deps-green-1280.svg) / [`.txt`](lint-deps-green.txt) | `pnpm lint:deps` green on the tree as it lands. |
| [`lint-deps-violation-1280.svg`](lint-deps-violation-1280.svg) / [`.txt`](lint-deps-violation.txt) | The demo: a type-only `import type { PM_TABLE_PREFIX } from '@paperos/pm'` added to `packages/views/src/index.ts`. Rule `R3-cross-module-packages-pm` fires, names the import, the fix and the owner (pm-linear), and the type-only edge is caught (R8). Reverted afterwards. |
| [`check-green.txt`](check-green.txt) | `pnpm check` (lint, typecheck, test, build, `//#lint:deps`) green. |

The terminal captures are SVG at 1280 px rather than PNG: this container has no screenshot tool or
image library, and an SVG of the real captured output is legible at any width and diffs as text.
The `.txt` files are the raw output the SVGs render.
