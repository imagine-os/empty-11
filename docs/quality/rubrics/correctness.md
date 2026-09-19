<!-- GENERATED from packages/contracts/quality/src/rubrics/correctness.json by packages/contracts/quality/scripts/build-docs.ts. Edit the JSON, then run `pnpm --filter @paperos/contract-quality build:docs`. -->

# Correctness rubric (`RUB-COR-*`, v1)

Applied by: `correctness`, `edge-case`. Severity names and the gate rule: [severity.md](./severity.md). Finding shape: [finding.schema.json](./finding.schema.json).

## Purpose

Does the code do what its types, its spec and its tests claim, for every input the product will actually see? The correctness reviewer (PAP-244) embeds this rubric; the edge-case hunter (PAP-85) reuses its items as oracles.

## Scope

Application and package code in the diff, the tests that ship with it, and the runtime behaviour a reviewer can reproduce with `pnpm test`. Includes generated code only to the extent of pointing at the generator.

## Examples by severity

- **S0**
  - A migration drops or rewrites a column without a backfill: data loss.
  - A retry loop re-applies a non-idempotent payment mutation.
- **S1**
  - An empty list crashes the page instead of rendering the declared empty state.
  - Pagination skips or repeats a row at the page boundary.
- **S2**
  - A date is formatted in the server's timezone in a tooltip only.
  - A test asserts that the function ran, not what it returned.

## Checklist

Each item is a question the reviewer answers with `checked`, `n/a` or `skipped` in `rubricCoverage`, so silence differs from a skipped check. Typical severity is the starting point; the [severity taxonomy](./severity.md) and its caps decide.

| ID | Item | Test | Typical | How to verify | False positives |
|---|---|---|---|---|---|
| `RUB-COR-01` | Types versus runtime | Can I construct a value the TypeScript type allows that the runtime rejects, or a runtime value the type says cannot exist (unchecked casts, `as`, `!`, `any`, JSON parsed without a schema)? | S1 | Trace every `as`, `!` and external input (HTTP body, DB row, env, file) in the diff to a Zod parse or a runtime check; write the failing input as a test. | A cast guarded by an adjacent runtime check on the same value; generated types from Drizzle or oRPC that the generator proves. |
| `RUB-COR-02` | Null, undefined and empty | Can I pass null, undefined, an empty string, an empty array or zero and make the code throw, render nothing, or treat the value as present? | S1 | For each new function, list its parameters and call it with each empty value; check `noUncheckedIndexedAccess` sites (`arr[0]`, `map.get()`) are narrowed before use. | Values the type system already excludes and that no external boundary can produce; a documented `never empty` invariant with a test that proves it. |
| `RUB-COR-03` | Error paths | Can I make a dependency (DB, network, file, other module) fail or time out and get a swallowed error, a half-applied change, a misleading success, or a stack trace shown to the user? | S1 | Find every `try`/`catch`, `.catch`, `Promise.all` and awaited call; confirm the failure surfaces as a typed error (Contracts §4 codes) or a declared error state, and that a test exercises it. | Intentional best-effort paths (telemetry, prefetch) that log and continue and are labelled as such. |
| `RUB-COR-04` | Async ordering and races | Can two overlapping calls (double click, fast navigation, concurrent webhook) interleave so that the later result is overwritten by the earlier one, state is read before it is written, or a listener fires after unmount? | S1 | Look for awaited calls inside loops, un-awaited promises, missing abort controllers or request sequence checks, and effects without cleanup; reproduce with two interleaved calls in a test. | Calls serialised by a queue, transaction or mutex that the reviewer can point to. |
| `RUB-COR-05` | Idempotency | Can I replay the same request, event or job (retry, webhook redelivery, double submit) and get a duplicate row, a double charge or a second notification? | S0 | For every mutation reachable from a retryable caller, find the idempotency key, unique constraint or `ON CONFLICT`; replay the fixture twice in a test and assert one effect. | Naturally idempotent writes (set a field to a value) and reads. Financial mutations without a key are never a false positive (Ledger). |
| `RUB-COR-06` | Transactions and partial writes | Can I fail the second of two related writes and leave the first committed, or read uncommitted state from another connection? | S0 | Check multi-table writes run inside one `db.transaction` with the tenant context set inside it; inject a failure after the first write in a test and assert rollback. | Writes that are independent by design and documented as eventually consistent through the outbox (ADR 0013). |
| `RUB-COR-07` | Timezone, locale and units | Can I pick a user timezone, locale or currency that makes a date shift by a day, a number parse wrong, a sort order change, or a string compare fail (`toLowerCase` on Turkish, `localeCompare` missing)? | S2 | Search for `new Date(`, `toLocale*`, `getHours`, string sorts and currency maths in the diff; run the test with `TZ=Pacific/Kiritimati` and `es-MX`. | Values stored and compared as UTC instants or `date-only` types (ADR 0011) and only formatted at the edge. Financial rounding errors are S1, not S2 (Ledger). |
| `RUB-COR-08` | Pagination, limits and boundaries | Can I choose a page size, cursor or offset that skips a row, repeats a row, loops forever, or returns more than the `limit <= 100` cap? | S1 | Read the cursor comparison (`>` versus `>=`), the sort key uniqueness and the limit clamp; seed limit+1 rows in a test and walk every page. | A list that is bounded by construction (enum-sized) and says so. |
| `RUB-COR-09` | Cleanup and resource lifetime | Can I mount and unmount, open and close, or start and cancel repeatedly and leak a listener, timer, subscription, file handle or temp row? | S2 | Every `addEventListener`, `setInterval`, `subscribe`, `open` and temp write in the diff has a matching removal on the same path; assert count stability across 100 cycles in a test. | Process-lifetime singletons that are documented as such. |
| `RUB-COR-10` | Meaningful tests | Can I break the behaviour under review and keep every new test green (tests that assert only `toBeDefined`, snapshot the implementation, mock the unit under test, or never run because of a bad `describe` filter)? | S2 | For each new test read the assertion, not the name; mentally (or actually) mutate the code and confirm the test would fail; check `pnpm test --filter <pkg>` output is cited for any claim about tests (PAP-244). | Type-level tests and compile-only fixtures whose purpose is stated in the file. |

## What this rubric does not cover

- Authorisation, tenant isolation, secrets and injection (security rubric).
- Whether the behaviour matches the page spec (spec-conformance rubric).
- Performance thresholds (performance rubric, PAP-87).
- Style, naming and formatting: Biome owns those in Gate 1.
