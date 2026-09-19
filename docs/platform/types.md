# Shared value types and wire encodings

Owner: **data-layer** (PAP-302). Decision: [ADR 0011](../adr/0011-shared-value-types.md).
Code: [`packages/core/src/types/`](../../packages/core/src/types/index.ts) (`@paperos/core/types`)
and [`packages/db/src/schema/_shared.ts`](../../packages/db/src/schema/_shared.ts).

These are the handful of values that cross every boundary in PaperOS. Each one has **one**
spelling in TypeScript, **one** in Postgres and **one** in JSON. If you are about to write
`amount_cents`, a `number` for money, or a second actor shape, stop and use these instead.

## The table

| Type | TypeScript | Postgres | JSON | Example |
| -- | -- | -- | -- | -- |
| Id | `Uuid` (branded `string`), minted by `uuidv7()` | `uuid`, default `uuid_generate_v7()` (PAP-32) | lowercase string | `"0192f0c1-2b3d-7c4e-8f90-abcdefabcdef"` |
| Instant | `IsoDateTime` (branded `string`); `Date` in memory via `parseIsoDateTime` | `timestamptz` | ISO-8601 UTC **with milliseconds**, `Z` suffix | `"2026-09-19T14:03:11.482Z"` |
| Calendar day | `IsoDate` (branded `string`) — never a `Date` | `date` | `YYYY-MM-DD` | `"2026-09-19"` |
| Duration | `Duration` (branded `number`, whole ms) | `interval` or `integer` ms | number | `3600000` |
| Money | `Money = { amountMinor: bigint; currency: Iso4217 }` | `money('amount')` → `amount_minor bigint`, `currency char(3)` | `{ amountMinor: string, currency: string }` | `{"amountMinor":"1999","currency":"USD"}` |
| Exact decimal | `Decimal` (branded `string`) — ratios, tax rates, major-unit amounts | `numeric` | string | `"0.0825"` |
| Actor | `ActorRef = { id, type, character?, onBehalfOf? }` | `actorRef('actor')` → `actor_id uuid`, `actor_kind text`, `actor_character text` | object | `{"id":"0192…","type":"agent","character":"forge"}` |
| Entity pointer | `EntityRef = { type: string; id: Uuid }` | `entityRef('subject')` → `subject_type text`, `subject_id uuid` | object, or the key form | `{"type":"invoice","id":"0192…"}` / `"entity:invoice:0192…"` |
| Cursor | opaque `string` from `signCursor` | not stored | base64url `payload.tag` | `"eyJzIjpbMTk5OV0…._B77xq55jlEJz3VYD4TX-Q"` |
| Error body | `ApiErrorBody` | not stored | object | `{"code":"VALIDATION","message":"…","requestId":"req_1"}` |

## Money

`Money` is an exact integer count of the currency's **minor units** plus an ISO 4217 code.
`19.99 USD` is `1999n`, `1999 JPY` is `1999n` (the yen has no minor unit), `19.990 BHD` is
`19990n` (the dinar has three). `minorUnits(currency)` is the table.

* **Why `bigint`:** a ledger passes 2^53 minor units at about ninety billion dollars, sooner in
  IDR or VND, and floats cannot represent `0.1 + 0.2`.
* **Why a string on the wire:** JSON has no bigint and `JSON.parse` silently rounds a large
  number literal. So `amountMinor` is a **decimal string** in JSON, always.
* **Arithmetic:** `add`, `subtract`, `negate`, `abs`, `multiply(value, ratio, rounding?)`,
  `allocate(value, ratios)`, `compare`, `equals`, `isZero`, `isNegative`, `isPositive`.
  `add(usd, eur)` throws `CurrencyMismatch` — conversion is PAP-175's job, not an implicit one.
* **Rounding** defaults to `halfEven` (banker's), which does not bias a long run of roundings
  upward. `halfUp`, `down`, `up`, `floor` and `ceil` are available where a tax authority insists.
* **`allocate`** uses the largest-remainder method: `allocate(money(1999, 'USD'), [1, 1, 1])` is
  `[667, 666, 666]`. The shares always sum back to the original amount exactly — no cent is lost
  and none is invented — and leftovers go to the largest fractional remainders, ties by position.
* **Formatting for display is not here.** That is locale work and belongs to `formatMoney`
  (PAP-27). Conversion between currencies is PAP-175.

## Actors

`Principal` (PAP-55) is the full identity. `ActorRef` is the projection stored on rows, events,
comments and audit records: small enough to denormalise, complete enough to render
"Forge (agent) on behalf of Justin" with no join. `toActorRef(principal)` does the projection and
lifts `attributes.character` when it is set.

`type` is exactly PAP-55's `PrincipalType` — `human | agent | service | anonymous` — the same enum
that `user.kind` (PAP-33) and `principalType` (PAP-57, PAP-60) are storage views of. Until PAP-55
merges, `actor.ts` holds a local copy of the union and `actor.test.ts` pins them together with
`expectTypeOf<ActorRef['type']>().toEqualTypeOf<PrincipalType>()`.

`ANONYMOUS_ACTOR` carries the nil UUID so the type stays total. In storage, `actor_id` is `NULL`
for it and the CHECK emitted by `actorRefCheck` says that is the only case:
`(actor_kind = 'anonymous') = (actor_id is null)`.

## Entity references

`EntityRef` is how a comment, a notification, a search document, an audit row or an event subject
names the thing it is about without a foreign key per table. Two columns in Postgres
(`<name>_type`, `<name>_id`); one string where only one field is available:
`entity:<type>:<id>` — the same grammar as the PAP-131 comment anchor, so an anchor and a subject
parse with one parser.

`type` is a dataset key (`invoice`, `pm_issue`, `file`). It is grammar-checked always
(`lower_snake_case`) and membership-checked when `packages/views` installs its registry through
`setEntityTypeValidator(hasDataset)`. `@paperos/core` cannot import `packages/views`, so the check
is injected rather than imported.

**A global entity has no tenant.** `entity:user:<id>` points at a row in the global `user` table;
consumers must not assume an `EntityRef` is tenant-scoped.

## Cursors

`signCursor({ sort, id })` returns `base64url(payload) + '.' + base64url(tag)`, where the tag is
HMAC-SHA-256 truncated to 16 bytes. The payload carries the sort values and the id of the last row
of a page, which is what makes the next page a keyset predicate instead of an `OFFSET`.

The cursor is **signed, not encrypted**: sort values are visible, and a sort value must therefore
never be a secret. It is signed because it comes back from the client as part of a `WHERE` clause.
`verifyCursor` throws `VALIDATION` on a malformed, truncated or tampered cursor — a 400, never
a 500.

* **Secret:** `CURSOR_SECRET` (PAP-17), read **at the call site and never at import**, so that
  importing `@paperos/core/types` in a browser bundle, a test or a codegen script cannot fail on a
  missing variable. Pass a `CursorSecrets` argument and the environment is not touched at all.
* **Rotation:** set `CURSOR_SECRET_PREVIOUS` to the old value. `verifyCursor` accepts either,
  `signCursor` only ever uses the new one, and the old value is removed after 24 hours — longer
  than any page-through. `previousUntil` narrows the window in code.
* Both PAP-268 (routers) and PAP-163 (tables compiler) import these functions; there is one
  signer in the workspace.

## Errors

`ApiErrorCode` is closed: `UNAUTHORIZED | FORBIDDEN | NOT_FOUND | CONFLICT | VALIDATION |
RATE_LIMITED | PAYLOAD_TOO_LARGE | INTERNAL`. `HTTP_STATUS_BY_API_ERROR_CODE` maps each to its
status, so a route never picks one. `ApiErrorBody` is
`{ code, message, requestId, details?, retryAfter? }`; `ApiError` is the class every package
throws and `ValidationError` is its `VALIDATION` subclass, which every parser in this folder uses.

## Zod and JSON Schema

Zod 4 is the schema language and JSON Schema is generated, never hand-written. The rule that keeps
that honest: **`z.bigint()` never appears on a wire schema**, because JSON has no bigint and
`z.toJSONSchema()` refuses to render one. So:

* `moneyJsonSchema` is the wire schema — `{ amountMinor: string, currency: string }` — and every
  generated artefact (OpenAPI, the SDK, the spec builder) comes from it.
* `moneySchema` is the domain parser: it accepts the wire form *or* an in-memory `bigint` and
  always outputs a `Money` with a `bigint` amount. It is not a wire schema and must not be handed
  to a generator.

`wire.test.ts` renders every wire schema through `z.toJSONSchema()` on each run, so a schema that
grows a bigint fails the build.

## What is deliberately not here

`@paperos/core/types` has no dependency on React, Drizzle, the database, the network or Node: it
is contract-zero and every package, including every `@paperos/contract-*`, may import it. That is
why the Postgres column helpers live in `@paperos/db` and the HMAC is a dependency-free
implementation rather than `node:crypto`.

## Demo

```
pnpm --filter @paperos/core example:types
```

Prints a `Money` value as JSON and parses it back, splits $19.99 three ways, mints sortable ids,
signs a cursor and shows a tampered cursor rejected.
