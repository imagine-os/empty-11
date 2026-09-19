/**
 * `@paperos/boundaries` — the package boundary map's tooling (PAP-305, ADR 0026).
 *
 * `ownership.json` is the source of truth; this package reads it, generates
 * `.dependency-cruiser.cjs` and `docs/platform/dependency-map.*` from it, and
 * ships the tests that keep the three in step. The schema itself lives in
 * `@paperos/core/modules` so packages that cannot depend on `node:*` can still
 * read the types.
 */

export * from './check.js';
export * from './format.js';
export * from './glob.js';
export * from './map.js';
export * from './repo.js';
export * from './rules.js';
