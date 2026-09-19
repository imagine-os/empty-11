/** Specifier a repo puts in the `"extends"` array of its root `biome.json`. */
export const BIOME_PRESET = '@paperos/config-biome/preset.json' as const;

/** Formatting the preset enforces; documented so docs and CI can assert it. */
export const BIOME_STYLE = {
  indentStyle: 'space',
  indentWidth: 2,
  quoteStyle: 'single',
  organizeImports: true,
} as const;
