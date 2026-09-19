/**
 * `@paperos/views` — view model, compiler, field types and automations (tables / Nova, PAP-161..PAP-174).
 *
 * PAP-161 lands the view model (`src/model`, ADR 0016) and the dataset registry port
 * (`src/registry`). The compiler (PAP-163), field type runtime (PAP-164) and view kinds add
 * folders beside them; `@paperos/contract-tables` (PAP-483) re-exports the types and ports from
 * here so other modules never import this package directly.
 */
export const VIEWS_PACKAGE_ID = '@paperos/views' as const;

export * from './model/index.js';
export * from './registry/index.js';
