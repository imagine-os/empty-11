/**
 * Preset ids of `@paperos/config-ts`. A package extends one of these from its
 * own `tsconfig.json`; nothing here is runtime code.
 */
export const TS_PRESETS = ['base', 'react', 'node'] as const;

export type TsPreset = (typeof TS_PRESETS)[number];

/** Specifier a package puts in `"extends"` for a given preset. */
export function presetSpecifier(preset: TsPreset): string {
  return `@paperos/config-ts/${preset}.json`;
}
