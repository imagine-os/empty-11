/**
 * `@paperos/core/modules` — module manifest and package ownership primitives.
 *
 * Owner: app-shell (PAP-264 manifest, PAP-305 ownership, PAP-433 schema
 * generation). Re-exported from the `@paperos/core` barrel and available
 * directly as `@paperos/core/modules` so a Vite config can import the
 * validator without pulling the rest of contract-zero in.
 */

export * from './manifest.js';
export * from './ownership.js';
