# 0012. Filter grammar

* Status: Accepted
* Date: 2026-09-19
* Issue: [PAP-279](https://linear.app/paperos/issue/PAP-279)
* Deciders: Forge (build) with Nova, Sentinel (review)

## Context

Six projects were about to define their own filter shape: permissions `Condition` (PAP-59),
the view model `FilterGroup` (PAP-161), the spec data section (PAP-119, a copy with a TODO),
the filter builder (PAP-166), segments (PAP-195) and automations (PAP-174). Each would have
needed its own SQL compiler, its own in-memory check for optimistic UI and RLS previews, and its
own URL encoding, and they would have drifted. Interface & Data Contracts §1 names one type,
`FilterTree` from `@paperos/core/filter`, and §4 fixes `filter?: FilterTree` on every list
procedure. This ADR records what that type is and the rules that keep its two evaluators equal.

## Decision

1. **One grammar, in `packages/core/src/filter`, exported as `@paperos/core/filter`.**
   `FilterTree = Group | Condition` with `v: 1` at the root; `Group = { op: and | or | not,
   children }`; `Condition = { field, operator, value? }`. Fifteen operators (`eq`, `neq`, `in`,
   `nin`, `lt`, `lte`, `gt`, `gte`, `contains`, `startsWith`, `isNull`, `isNotNull`, `between`,
   `has`, `matches`), ten field types, an operator × type table in `docs/platform/filter.md`.
   Limits 8 groups deep, 200 conditions. Zod 4 is the schema; JSON Schema is generated.
2. **A `FieldSchema` types every value.** Structure validates without one; `toSql` and
   `evaluate` need one. Unknown fields fail with suggestions, wrong operators name the allowed
   ones, and TypeScript narrows `value` per field and operator (`ValueFor`, `condition()`).
3. **Two evaluators from one operator table.** Each operator definition carries its SQL and its
   in-memory function side by side; `toSql` returns a Drizzle `SQL` fragment and never opens a
   connection; `evaluate` follows SQL three-valued logic (`evaluateThreeValued` exposes UNKNOWN).
   Equivalence is proven by a fast-check property on PGlite (500 trees × 48 rows with NULLs),
   which is the gate for any future operator.
4. **Semantics fixed here.** `in []` is false, `nin []` is true; `contains`/`startsWith` are
   `ILIKE` with escaped wildcards; `caseInsensitive: true` on a string field means `lower()` on
   both sides (citext contract); no ordering on strings; `matches` is Postgres `#>` with optional
   jsonb equality; variables `{ $var }` resolve at evaluation and never default; a literal `null`
   is rejected in favour of `isNull`.
5. **Canonical form, wording, URL form, versions.** `normalize` (idempotent, meaning-preserving),
   `explain` (English and Spanish, labels from the schema), `encodeFilter`/`decodeFilter`
   (`1.<base64url>` of a compact array form, validated on decode), `migrateFilter` with a
   `MIGRATIONS` table for future `v`.
6. **Extension hook instead of forks.** `createFilterGrammar({ operators })` builds a grammar with
   extra operators for a module (PAP-161's view operators); the built-ins never change without an
   ADR.

## Consequences

* `packages/core` gains two runtime dependencies, `zod` and `drizzle-orm` (the `sql` helper only),
  and dev dependencies `@electric-sql/pglite`, `fast-check`, `tsx`. Core stays free of React,
  database connections and env reads.
* Consumers alias the type (`type Condition = FilterTree`) and delete their copies; PAP-59,
  PAP-161 and PAP-119 were asked to acknowledge.
* Adding an operator means: a row in the operator table (SQL, evaluate, explain, code), a row in
  `docs/platform/filter.md`, the property test green, and a new ADR superseding this one for the
  built-in set. Module-specific operators use the hook and need no ADR.
* Ordering on strings, SQL/JSON path queries and full-text search are deliberately absent.

## Alternatives rejected

* **Per-project filter shapes with a shared "compatible subset".** Drift is the failure mode this
  ADR exists to prevent; a subset without a shared compiler is a promise, not a contract.
* **Prisma-style object filters (`{ amount: { gt: 1 } }`).** Compact for code, but the field name
  is a key, which makes a filter builder, a URL encoding and a JSON Schema awkward and makes
  `not`/`or` nesting irregular. The explicit tree is uniform for tools.
* **Compiling to SQL strings instead of Drizzle `SQL`.** Drizzle's tagged template parameterises
  every value and renders columns from the table definition, which removes a whole class of
  injection and quoting bugs; the fragment prints to text through `PgDialect` when needed.
* **Testing equivalence against a Docker Postgres.** PGlite runs in-process in Vitest with no
  service to start, so the property test runs in `pnpm check` on every push.
* **`jsonpath` (`@?`) for `matches`.** Richer, but lax-mode unwrapping and strict-mode errors are
  hard to mirror in memory. `#>` is small, exact and enough for "field at path equals value".
* **Case-insensitive strings by default.** Postgres text is case-sensitive; making `eq` differ
  from SQL by default would surprise every raw query. Opt in per field instead.
