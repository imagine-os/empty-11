<!-- GENERATED from packages/contracts/quality/src/rubrics/performance.json by packages/contracts/quality/scripts/build-docs.ts. Edit the JSON, then run `pnpm --filter @paperos/contract-quality build:docs`. -->

# Performance rubric (`RUB-PERF-*`, v1)

Applied by: `correctness`, `edge-case`. Severity names and the gate rule: [severity.md](./severity.md). Finding shape: [finding.schema.json](./finding.schema.json).

## Purpose

Will this change make the product slower for a real tenant, on a real phone, at real data sizes? Thresholds (LCP, INP, bundle size, query time) belong to PAP-87 and PAP-242; this rubric names the patterns a reviewer can see in a diff before any budget runs, so a finding here without a measured threshold is S2 unless it is unbounded.

## Scope

Queries, loops, renders, bundles, payloads and jobs in the diff; test suite duration.

## Examples by severity

- **S0**
  - A background job loads every row of a tenant table into memory with no limit: the 8 GB host falls over (broken build in production terms).
- **S1**
  - A list endpoint returns unbounded results because the new filter bypasses the `limit` clamp.
  - A render loop re-fetches on every keystroke with no debounce and no abort.
- **S2**
  - N+1 query in a loop over 20 rows.
  - A 300 KB dependency added for one formatting helper.

## Checklist

Each item is a question the reviewer answers with `checked`, `n/a` or `skipped` in `rubricCoverage`, so silence differs from a skipped check. Typical severity is the starting point; the [severity taxonomy](./severity.md) and its caps decide.

| ID | Item | Test | Typical | How to verify | False positives |
|---|---|---|---|---|---|
| `RUB-PERF-01` | Bundle growth | Does the diff add a dependency, a large asset or a non-lazy import to a route that noticeably grows the initial bundle, or import a whole library for one function? | S2 | `size-limit` or the build's chunk report; check for deep imports and lazy routes; cite the added bytes when measured. | Dev-only or worker-only dependencies. |
| `RUB-PERF-02` | N+1 and unbounded queries | Can I find a query inside a loop, a join-less fetch per row, a query without `limit`, or a count over an unindexed predicate? | S2 | Read every `await db.` inside `for`, `map` or `Promise.all`; check `limit <= 100` (S1 when unbounded on a user-facing list); check the index exists for new `where` columns. | Loops bounded by a small enum with a comment saying so. |
| `RUB-PERF-03` | Render churn | Can I type or hover and cause a whole list or table to re-render, an effect to fire every render (missing deps), or a new object identity to break memoisation? | S2 | React profiler on the changed page; look for inline object props to memoised children, effects without deps, and state lifted higher than needed. | Small trees where the churn is measured under 16 ms. |
| `RUB-PERF-04` | Main-thread blocking | Can I supply a large but plausible input (10 000 rows, a 5 MB document) and freeze the UI for over 100 ms in synchronous parsing, sorting, hashing or layout? | S2 | Run the operation with the large fixture under CPU throttle (Gate 4); long tasks in the trace; work moved to a worker or chunked. | One-off imports with a progress indicator. |
| `RUB-PERF-05` | Unbounded payloads and memory | Can I make a request, event or job carry or hold an unbounded array, an entire file in memory, or a stream buffered to completion? | S1 | Body size limits on routes, streaming for files, `limit` on every collection payload, caps in the event envelope; cite the missing bound. | Internal payloads bounded by the producer's own limit, with a link to it. |
| `RUB-PERF-06` | Caching and repeated work | Can I find the same expensive computation, fetch or permission check repeated per render, per row or per request with no memo, cache or batching where the result is stable? | S3 | Look for repeated `can()` calls per row, repeated `JSON.parse` of the same string, repeated formatter construction (`new Intl.*` in a loop). | Work that is trivially cheap (under a microsecond) or must be fresh. |
| `RUB-PERF-07` | Slow tests and CI time | Does the diff add tests that sleep, hit the network, start real servers per test, or add more than 30 s to the suite without a reason? | S3 | Compare Gate 1 duration before and after; grep for `setTimeout` in tests, unmocked fetch, per-test container start. | Integration suites tagged for nightly (PAP-253). |
| `RUB-PERF-08` | Budgets when measured | Does a Gate 1 performance artefact (`perf.json`, PAP-87 or PAP-242) show a budget regression attributable to this diff? | S1 | Read `reports/perf.json` when present and cite the metric, the budget and the delta; until PAP-87 lands record `n/a`. | Regressions inside the run-to-run noise band the budget declares. |

## What this rubric does not cover

- Budget numbers and their enforcement (PAP-87 web budgets, PAP-242 API and database budgets).
- Infrastructure sizing (PAP-214).
- Load testing (PAP-147).
