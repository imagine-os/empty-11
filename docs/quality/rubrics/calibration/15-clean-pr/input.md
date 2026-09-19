# Case 15: a clean PR

PR adds `packages/core/src/filter/normalize.ts` (pure function, 40 lines) with a Zod-validated input, exhaustive switch over the filter grammar (ADR 0012), 14 unit tests including empty, unicode and nested cases, a changelog fragment and a spec link. Gate 1 green. No routes, no UI, no queries.
