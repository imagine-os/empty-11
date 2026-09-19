### Added — PAP-66: design tokens (colour, type, space, radius, motion, elevation)

- DTCG JSON token source (`packages/tokens/tokens/`) compiled to CSS custom properties
  (`--pos-*`), a Tailwind v4 `@theme` draft, and typed TS exports (`tokens`, `rawTokens`,
  `TokenPath`), in light, dark and hc themes with fluid `clamp()` type sizes (360px-3840px) and an
  sRGB fallback for browsers without OKLCH.
- Paths: `packages/tokens/**` (new package `@paperos/tokens`), `docs/platform/design-tokens.md`,
  `docs/evidence/PAP-66/`.
- ADR: [0018-design-tokens](../../adr/0018-design-tokens.md)
- Review fix (Sentinel): `packages/tokens/biome.json` is a nested config (`"root": false`,
  `"extends": "//"`) like its siblings; as a second root it failed `biome check` in every other
  package once the turbo cache missed (the `@paperos/web#lint` failure that blocked PAP-15). The
  `@supports not (color: oklch(...))` block now mirrors the light default of every theme-varying
  colour in `:root`, not only the shared tokens (`src/lib/generate-css.ts`, snapshot regenerated).
