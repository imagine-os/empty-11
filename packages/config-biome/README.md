# @paperos/config-biome

The Biome 2 preset every PaperOS repo extends. The root `biome.json` adds only
repo-local concerns (VCS ignore file, path excludes); rules and formatting live here.

House style: 2-space indent, single quotes, semicolons, trailing commas, import sorting on,
`noUnusedImports` / `noUnusedVariables` as errors.

Owner: app-shell (Forge). Changing a rule changes every package; open an ADR first.

## Generated `overrides`

The `overrides` array in `preset.json` is **generated** by `pnpm gen:deps-rules` from
`ownership.json` (PAP-305, ADR 0026): it mirrors boundary rule R3 as Biome's
`noRestrictedImports` so a cross-module import is underlined in the editor, not only at
`pnpm lint:deps`. Do not hand-edit it — change `ownership.json` and re-run the generator. A test
in `@paperos/boundaries` fails when the block is stale. Everything else in `preset.json` is
hand-written and belongs to PAP-13.
