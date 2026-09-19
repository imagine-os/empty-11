# @paperos/config-biome

The Biome 2 preset every PaperOS repo extends. The root `biome.json` adds only
repo-local concerns (VCS ignore file, path excludes); rules and formatting live here.

House style: 2-space indent, single quotes, semicolons, trailing commas, import sorting on,
`noUnusedImports` / `noUnusedVariables` as errors.

Owner: app-shell (Forge). Changing a rule changes every package; open an ADR first.
