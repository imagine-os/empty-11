# @paperos/config-ts

Shared TypeScript presets. Extend one from a package `tsconfig.json`:

| Preset | For | Adds |
| -- | -- | -- |
| `@paperos/config-ts/base.json` | pure TypeScript packages | strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `moduleResolution: bundler` |
| `@paperos/config-ts/react.json` | React apps and packages | DOM libs, `jsx: react-jsx`, `vite/client` types |
| `@paperos/config-ts/node.json` | Node processes and tooling | `@types/node` |

Owner: app-shell (Forge). Changing a flag here changes every package; open an ADR first.
