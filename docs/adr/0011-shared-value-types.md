# 0011. Shared value types and wire encodings

* Status: Accepted
* Date: 2026-09-19
* Issue: [PAP-302](https://linear.app/paperos/issue/PAP-302)
* Deciders: Forge (build), Sentinel (review), Ledger (finance types)

## Context

A handful of values cross every boundary in PaperOS, and the plan had them spelled three ways
before a line was written. `Money` was a `number` in PAP-71 and PAP-164, a `bigint` in PAP-175 and
an `amount_cents` column in PAP-187. The actor on a row was `user.kind` in PAP-33, a context
`actor` in PAP-35, a `Principal` in PAP-55 and a `principalType` in PAP-60. Ids, timestamps,
cursors and error bodies were each about to be re-derived by whichever session got there first.

Thirty-odd issues depend on these shapes and most of them are built in parallel. Divergence here
is not a style problem: a `number` money in one router and a `bigint` money in the ledger is a
silent rounding bug at 2^53, and two actor shapes mean two audit tables that cannot be joined.
Interface & Data Contracts section 1 is the prose; this ADR is the code's half of it.

Four constraints shaped the answer. `packages/core` is contract-zero — no React, no database, no
network, no environment reads — because every package including every `@paperos/contract-*`
imports it. JSON has no bigint, and `JSON.parse` silently rounds a large number literal. Zod 4 is
the schema language and JSON Schema is generated from it, never hand-written. And PAP-55 (the
canonical `Principal`) and PAP-32 (`packages/db`) had not merged when this landed, so neither
could be a hard dependency.

## Decision

`@paperos/core/types` owns the value types; `@paperos/db` owns their Postgres spelling. The full
table is [`docs/platform/types.md`](../platform/types.md).

| Concern | Decision |
| -- | -- |
| Ids | `Uuid`, a branded lowercase string. `uuidv7()` mints RFC 9562 version 7 ids with a 12-bit in-process counter, so they are monotonic within a process and interchangeable with `uuid_generate_v7()` (PAP-32). |
| Instants | `IsoDateTime`, ISO-8601 UTC **with milliseconds**; `timestamptz` in Postgres, `Date` in memory. |
| Calendar days | `IsoDate` (`YYYY-MM-DD`), never a `Date` — a `Date` drags a timezone in and moves the day. |
| Money | `{ amountMinor: bigint; currency: Iso4217 }`, an exact count of the currency's minor units; `amount_minor bigint + currency char(3)` in Postgres; a **decimal string** in JSON. |
| Money arithmetic | Exact bigint arithmetic. Rounding defaults to half-even. `allocate` is largest remainder and always sums back exactly. Mixed currencies throw `CurrencyMismatch`; no implicit conversion, ever. |
| Actors | `ActorRef = { id, type, character?, onBehalfOf? }`, the projection of PAP-55 `Principal` stored on rows and events. `type` is exactly `PrincipalType`. |
| Entity pointers | `EntityRef = { type, id }`, two columns in Postgres, `entity:<type>:<id>` as one string — the PAP-131 anchor grammar. |
| Cursors | `signCursor` / `verifyCursor`, HMAC-SHA-256 truncated to 16 bytes over the keyset payload, base64url. Signed, not encrypted. |
| Errors | `ApiErrorCode` closed union, `ApiErrorBody` fixed shape, status derived from the code. |
| Schemas | Zod 4. `z.bigint()` never appears on a wire schema; a test renders every wire schema through `z.toJSONSchema()` on each run. |

Five decisions inside that table are the ones worth arguing about, so they are written out:

1. **Money is a bigint of minor units, a string on the wire.** `number` loses exactness above 2^53
   minor units and cannot represent `0.1 + 0.2`; a JSON number literal is rounded by `JSON.parse`
   before any code sees it. The wire schema `moneyJsonSchema` therefore carries a decimal string,
   and the lenient domain parser `moneySchema` (which does accept a `bigint`) is explicitly not a
   wire schema.
2. **Half-even rounding by default, largest remainder for allocation.** Half-up biases a long run
   of roundings upward, which a ledger notices. Largest remainder is the split that keeps the
   parts summing to the whole, which is the property invoices and payouts need; a property test
   asserts it over random amounts and ratios.
3. **The HMAC is dependency-free TypeScript, not `node:crypto` or WebCrypto.** `node:crypto` would
   make `@paperos/core` Node-only; WebCrypto's `subtle` is async and would make `signCursor` async
   for every caller, including the tables compiler. A 150-line RFC 6234 implementation pinned by
   the RFC 4231 vectors costs less than either.
4. **The cursor secret is read at the call site, never at import.** Import-time environment reads
   make a package unimportable in a browser bundle, a test or a codegen script. `signCursor` takes
   an optional `CursorSecrets`; only when it is absent does it look at `CURSOR_SECRET`. This is the
   one place `@paperos/core` touches the environment at all, and it touches it lazily.
5. **`PrincipalType` is copied locally with a type-equality test.** PAP-55 owns the canonical
   union and had not merged. Blocking on it would have blocked thirty issues; guessing at it
   silently would have produced a second enum. The copy is four strings and
   `expectTypeOf<ActorRef['type']>().toEqualTypeOf<PrincipalType>()` fails the build the day the
   two drift. When PAP-55 lands, the copy is replaced by a re-export and the test keeps its
   meaning unchanged.

`packages/db` is created here as a minimal package holding only `src/schema/_shared.ts`
(`money()`, `actorRef()`, `actorRefCheck()`, `entityRef()`), because the Drizzle helpers cannot
live in contract-zero core and PAP-32 had not created the package yet. PAP-32 grows it.

## Consequences

* One `Money`, one `ActorRef`, one `EntityRef`, one cursor signer and one error body in the
  workspace. PAP-71, PAP-164, PAP-175, PAP-187, PAP-27, PAP-268, PAP-163, PAP-131 and PAP-136
  import them instead of re-deriving them.
* Every consumer of money must think about currency: there is no implicit conversion and
  `add(usd, eur)` throws. That is friction on purpose.
* `bigint` requires a runtime that has it. Every device in the matrix (PAP-14) does; a client
  without `BigInt` is unsupported and documented as such.
* Coverage on `money.ts` and `cursor.ts` is a gate at 100 %, enforced per file in
  `packages/core/vitest.config.ts`, not a report. Coverage is therefore always on for
  `@paperos/core`.
* `@paperos/core` now has a runtime dependency on Zod. It is the schema language for the whole
  platform, so this was going to happen at the first contract; it is recorded here.
* The core barrel re-exports the types folder flat, so short names like `add`, `compare` and
  `equals` are in `@paperos/core`'s top-level namespace. A later sub-folder that wants one of
  those names must import from `@paperos/core/types` instead, or namespace its own.
* The Drizzle helpers' integration test (`money()` round-tripping `9007199254740993n` through a
  real Postgres) waits for PAP-42's stack; the unit test asserts the generated column definitions
  and the bigint driver mapping without a database.

## Alternatives rejected

* **`number` for money, cents everywhere** — what PAP-71 and PAP-164 assumed. Cheaper to write and
  wrong above 2^53 minor units, which a ledger reaches. Rejected before the first invoice.
* **A decimal library (`decimal.js`, `dinero.js`)** — a good library and a dependency in
  contract-zero core, with its own serialisation format to map onto Postgres and JSON. The exact
  arithmetic here is a few dozen lines of bigint; the library would mostly add surface.
* **`numeric` in Postgres instead of `bigint` minor units** — exact, but it arrives in the driver
  as a string and invites a float on the way out, and it makes "the smallest unit" a per-query
  decision instead of a property of the currency.
* **A single `Amount` string like `"USD 19.99"`** — pretty in logs, and it pushes parsing into
  every consumer and makes SQL aggregation impossible.
* **Encrypting cursors instead of signing them** — hides sort values, needs key management and a
  bigger cursor, and the values are already visible to the client that sent them. Signing is what
  the threat actually needs: the cursor is a `WHERE` clause the client hands back.
* **A shared `nanoid`/UUIDv4 id** — no time ordering, so keyset pagination needs a second column
  and the index fragments. UUIDv7 keeps both.
* **Waiting for PAP-55 and PAP-32** — would have held thirty dependent issues for a four-string
  union and one file. See decision 5.
