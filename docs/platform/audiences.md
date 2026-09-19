# Audience model

Status: v1, 2026-09-19. Owner: identity (PAP-55). Code: `packages/core/src/audience/`, imported as
`@paperos/core/audience`. Decision record: [ADR 0017](../adr/0017-audience-model.md).
`AUDIENCE_MODEL_VERSION = 1`; any shape change here needs an ADR that supersedes 0017.

The audience model is the single vocabulary every page spec, policy, view and campaign uses to say
**who**. It has five parts: the `Principal` (who is acting), tenant roles and permission strings,
the segment expression language (a boolean tree over principal attributes), named audiences
(fifteen built-ins plus what an app declares), and the surface map (which audiences belong on which
entry point). Everything is pure TypeScript with Zod 4 schemas; nothing here touches a database,
a request or an environment variable.

What it is **not**: it does not evaluate permissions (`can()` is PAP-59), store memberships
(PAP-58) or define behavioural marketing segments (PAP-195 extends this model with usage
attributes).

## 1. Principal

```ts
type PrincipalType = 'human' | 'agent' | 'service' | 'anonymous';

type Principal = {
  id: string;              // UUIDv7; the literal `anonymous` for anonymous visitors
  type: PrincipalType;
  tenantId: string | null; // null for anonymous visitors and cross-tenant services
  attributes: Record<string, string | number | boolean | string[]>;
};
```

`Principal` is the canonical actor type of the platform ([Interface & Data Contracts §1]). The API
context `actor` (PAP-35, PAP-267) imports it; `user.kind` (PAP-33) and `principalType`
(PAP-57, PAP-60) are storage views of the same enum; `ActorRef = { id, type, character? }`
(PAP-302, `@paperos/core/types`) is the projection stored on rows, events and comments.

One `Principal` per active tenant: a user in three tenants is three principals with the same `id`
and different `tenantId`. PAP-58 builds it from the session and the membership.

Well-known attributes (`WELL_KNOWN_ATTRIBUTES`): `role` (tenant role), `tier`, `staffRole`,
`partnerId`, `character`, `emailVerified`, `mfa`, `actingFor`, `developer`. Apps add any other
key (`plan`, `region`, `seats`, ...). Arrays are sets of strings: `eq` matches any element,
`in` intersects.

## 2. Roles and permissions

```ts
type TenantRole = 'owner' | 'admin' | 'staff' | 'member' | 'viewer';   // rank 5 .. 1
type Permission = `${resource}:${action}`;                            // e.g. invoice:read, pm.issue:*
type CustomRole = { name: string; extends: TenantRole; permissions: Permission[] };
```

The five base roles map one-to-one onto Better Auth organization roles (PAP-58) and are the
`role` attribute on a principal. Custom roles are kebab-case names a tenant defines; every custom
role `extends` one base role, which is what audiences and `roleAtLeast` see. `role.permissions`
is a list of `resource:action` strings: lowercase dot-namespaced resource, lowercase verb or `*`.
This module owns the grammar (`PERMISSION_PATTERN`, `parsePermission`, `permissionSchema`);
evaluation, inheritance and row conditions are PAP-59's.

## 3. Segments

A segment is a small boolean tree:

| Node | Meaning |
| -- | -- |
| `{ all: Segment[] }` | every child matches; `{ all: [] }` is **everyone** |
| `{ any: Segment[] }` | at least one child matches; `{ any: [] }` is **no one** |
| `{ not: Segment }` | negation |
| `{ attr, op, value? }` | attribute test, operators below |
| `{ role: TenantRole }` | shorthand for `{ attr: 'role', op: 'eq', value }` |
| `{ tier: string }` | shorthand for `{ attr: 'tier', op: 'eq', value }` |
| `{ principalType }` | tests `principal.type`, not an attribute |
| `{ audience: id }` | the segment of another audience (built-in or declared) |

Operators, with `actual` the principal's attribute and `value` the segment's:

| `op` | `value` | True when |
| -- | -- | -- |
| `eq` | scalar | `actual === value`; for an array attribute, any element equals it |
| `neq` | scalar | attribute present and no element equals it |
| `in` | array | scalar `actual` is in the list; array `actual` intersects it |
| `gte` / `lte` | number or string | same-typed comparison; arrays match when any element does |
| `exists` | optional boolean | attribute present (`value: false` inverts: absent) |

A missing attribute makes every operator `false` except `exists` with `value: false`; a type
mismatch (`seats` is a number, `value` is a string) is `false`. `matches` never throws on an
attribute lookup, and never reads prototype properties. Depth is limited to
`SEGMENT_MAX_DEPTH = 6` (a leaf counts 1, `{ not: leaf }` counts 2); audience references do not add
literal depth, but they are cycle-checked.

`matches(principal, segment, { audiences? })` is pure and fast: the depth-6 unit test budgets
50 µs per call and measures well under 1 µs; `pnpm --filter @paperos/core exec vitest bench --run
src/audience` prints the numbers. It throws only `UnknownAudienceError` or `AudienceCycleError`,
both of which `validateAudiences` reports ahead of time.

`describe(segment)` renders one English phrase for developer-facing messages:
`{ any: [{ all: [{ audience: 'staff' }, { attr: 'staffRole', op: 'eq', value: 'support' }] }, { audience: 'admin' }] }`
reads *"staff whose staffRole is support, or admins"*. User-facing copy goes through the message
catalog; `describe` is English only by design.

## 4. Audience ids

`^[a-z][a-z0-9]*(-[a-z0-9]+)*(\.<segment>)*$` — kebab-case segments joined by dots.

* Built-ins are single kebab-case ids: `customer-pro`, `staff-support`.
* The dotted form is the namespace for **derived** families, so a derived id never collides with a
  built-in: `customer.<tier>`, `staff.<staffRole>`, `agent.<character>`. `deriveAudience('agent',
  'forge')` builds `{ id: 'agent.forge', match: { all: [{ audience: 'agent' }, { attr: 'character',
  op: 'eq', value: 'forge' }] } }`; apps declare the same shape by hand when they want one in
  `app.spec.yaml`.
* `anonymous` is the one audience with no attribute test; it ignores `tenantId`.

## 5. Built-in audiences

Every app has these fifteen; `app.spec.yaml` cannot redeclare one (`SHADOWS_BUILTIN`).

| Id | Name | `match` | `describe` |
| -- | -- | -- | -- |
| `everyone` | Everyone | `{ all: [] }` | everyone |
| `anonymous` | Anonymous visitors | `{ principalType: 'anonymous' }` | anonymous visitors |
| `authenticated` | Authenticated principals | `{ not: { principalType: 'anonymous' } }` | anyone except anonymous visitors |
| `customer` | Customers | `{ all: [{ principalType: 'human' }, { attr: 'tier', op: 'exists' }] }` | people who have a tier |
| `customer-free` | Free-tier customers | `{ all: [{ audience: 'customer' }, { tier: 'free' }] }` | customers on the free tier |
| `customer-pro` | Pro customers | `{ all: [{ audience: 'customer' }, { tier: 'pro' }] }` | customers on the pro tier |
| `customer-enterprise` | Enterprise customers | `{ all: [{ audience: 'customer' }, { tier: 'enterprise' }] }` | customers on the enterprise tier |
| `staff` | Staff | `{ all: [{ principalType: 'human' }, { attr: 'staffRole', op: 'exists' }] }` | people who have a staffRole |
| `staff-support` | Support staff | `{ all: [{ audience: 'staff' }, { attr: 'staffRole', op: 'eq', value: 'support' }] }` | staff whose staffRole is support |
| `staff-finance` | Finance staff | `{ all: [{ audience: 'staff' }, { attr: 'staffRole', op: 'eq', value: 'finance' }] }` | staff whose staffRole is finance |
| `admin` | Admins | `{ any: [{ role: 'admin' }, { role: 'owner' }] }` | admins, or owners |
| `owner` | Owners | `{ role: 'owner' }` | owners |
| `partner` | Partners | `{ attr: 'partnerId', op: 'exists' }` | principals who have a partnerId |
| `agent` | Agents | `{ principalType: 'agent' }` | agents |
| `developer` | Developers | `{ attr: 'developer', op: 'eq', value: true }` | principals whose developer is true |

Decisions baked into the table: owners are admins (an `admin` policy admits owners; an `owner`
policy does not admit admins); `customer` and `staff` are *humans* with a `tier` / `staffRole`, so
an agent acting for a customer is an `agent`, never a `customer`; `partner` is orthogonal to
`customer` (a partner is usually also a customer); built-in tier names are examples, an app with
`plan: basic` maps its own attribute. Each built-in carries a matching and a non-matching example
principal in `BUILTIN_AUDIENCES[id].examples` (`everyone` has no non-matching example); PAP-64 and
PAP-240 reuse them as fixtures.

## 6. Surfaces

A surface is one entry point of the hub. Each has the audience a page there is for unless its spec
narrows it, and the built-in audiences it may be narrowed to (`SURFACE_AUDIENCES`,
`defaultAudienceForSurface`, `isAudienceAllowedOnSurface`). PAP-114's `PageSpec.surface` uses
this enum.

| Surface | Default audience | May narrow to |
| -- | -- | -- |
| `website` | `everyone` | anonymous, authenticated, customer, partner |
| `app` | `authenticated` | customer, customer-free/pro/enterprise, partner, agent |
| `staff` | `staff` | staff-support, staff-finance, admin, owner, agent |
| `admin` | `admin` | owner |
| `docs` | `everyone` | authenticated, customer, staff, developer |
| `ops` | `staff` | admin, owner, developer |
| `dev` | `developer` | — |
| `testing` | `developer` | staff |
| `agent` | `agent` | developer |
| `api` | `authenticated` | customer, staff, admin, agent, partner |

## 7. Declaring audiences in `app.spec.yaml`

```yaml
audiences:                       # Record<AudienceId, Omit<Audience, 'id'>>  (shape agreed with PAP-117)
  vip:
    name: VIP customers
    description: Pro or enterprise customers who are also partners.
    match:
      all:
        - any: [{ audience: customer-pro }, { audience: customer-enterprise }]
        - audience: partner
  agent.forge:
    name: Agent forge
    description: The Forge agent character.
    match:
      all: [{ audience: agent }, { attr: character, op: eq, value: forge }]
```

`audiencesSectionSchema` is the Zod schema; `audiences.schema.json` beside it is the generated
JSON Schema (draft 2020-12, `$id https://paperos.dev/schemas/app-spec/audiences.schema.json`,
recursive `$defs/Segment`). Regenerate with `pnpm --filter @paperos/core gen:audience-schema`; a
test fails when the committed copy is stale. Page specs may reference only built-in or declared
ids; `spec validate` (PAP-116 / PAP-117) calls `validateAudiences(section)` and reports:

| Code | Meaning |
| -- | -- |
| `INVALID_ID` | id does not follow the grammar |
| `SHADOWS_BUILTIN` | id is one of the fifteen built-ins |
| `INVALID_SEGMENT` | Zod issue in `match` (path included), e.g. `in` without an array |
| `TOO_DEEP` | more than six levels |
| `UNKNOWN_REFERENCE` | `{ audience: id }` names nothing built-in or declared |
| `CYCLE` | references loop; the message names the path `gold -> platinum -> gold` |

`createAudienceRegistry(section)` returns the merged registry (`ids`, `get`, `resolve`,
`matches`, `matching`, `describe`) or throws `AudienceValidationError` with the same issues.
`BUILTIN_REGISTRY` is the default resolver of `matches` and `describe`.

Fixtures: `packages/core/src/audience/fixtures/app-spec.audiences.json` (valid),
`app-spec.audiences.cyclic.json` (a cycle, a shadowed built-in and an unknown reference),
`fixtures/principals/*.json`, and the golden outputs in `fixtures/golden/` (`describe.json`,
`matching.json`), locked by tests (`UPDATE_GOLDENS=1 pnpm --filter @paperos/core test` rewrites
them for review).

## 8. Worked examples

### A customer who is also a partner

`fixtures/principals/customer-partner.json`: a human, `tier: pro`, `partnerId: p-acme`,
`role: member`, `emailVerified: true`, `mfa: false`.

```
$ pnpm --filter @paperos/core audience explain --principal src/audience/fixtures/principals/customer-partner.json --audiences src/audience/fixtures/app-spec.audiences.json
[x] everyone              Everyone — everyone
[ ] anonymous             Anonymous visitors — anonymous visitors
[x] authenticated         Authenticated principals — anyone except anonymous visitors
[x] customer              Customers — people who have a tier
[ ] customer-free         Free-tier customers — customers on the free tier
[x] customer-pro          Pro customers — customers on the pro tier
...
[x] partner               Partners — principals who have a partnerId
[x] vip                   VIP customers — (pro customers, or enterprise customers) who are also partners
[x] verified-without-mfa  Verified, no MFA — people whose emailVerified is true and whose mfa is not true
matches: everyone, authenticated, customer, customer-pro, partner, vip, verified-without-mfa
```

Audiences compose: `partner` does not remove `customer`, so a page for `customer-pro` and a
campaign for `partner` both reach this principal, and `vip` (declared by the app) reaches them
because both hold.

### An agent acting for a staff member

`fixtures/principals/agent-acting-for-staff.json`: `type: agent`, `character: forge`,
`role: staff`, `actingFor: <support-staff id>`.

Matching built-ins: `everyone`, `authenticated`, `agent` — and `agent.forge` once the app
declares it. **Not** `staff` or `staff-support`: staff audiences require a human with a
`staffRole`, and the agent has neither. `role: staff` is the membership the agent's key was minted
under; it makes `{ role: 'staff' }` true but does not make the agent staff. A policy that wants to
let the agent do what the staff member could must check `actingFor` explicitly (PAP-59), resolve
that principal and evaluate it — the agent never inherits an audience by impersonation.

## 9. Edge cases

* **Multi-tenant user**: one `Principal` per active tenant; PAP-58 sets `tenantId` and `role`.
* **Anonymous on a public tenant page**: `anonymousPrincipal(tenantId)` — `anonymous` matches
  regardless of `tenantId`.
* **Agent impersonating a human**: `actingFor` attribute; `agent` still matches, policies check it.
* **App-specific tiers** (`plan: basic`): apps declare their own audiences over their own attribute;
  the built-in tiers are examples, not a constraint.
* **Unknown attribute**: `false`, never a throw; `exists` with `value: false` is the way to say
  "does not have".
* **Same audience referenced twice as siblings**: not a cycle; only a reference on its own
  resolution path is.

## 10. API

From `@paperos/core/audience` (also re-exported by `@paperos/core`):

* Types: `Principal`, `PrincipalType`, `AttributeValue`, `PrincipalAttributes`, `TenantRole`,
  `Permission`, `CustomRole`, `Segment`, `NormalizedSegment`, `SegmentOp`, `Audience`,
  `AudienceDeclaration`, `AudienceDeclarations`, `AudienceId`, `BuiltinAudienceId`, `Surface`,
  `AudienceRegistry`, `AudienceResolver`, `AudienceIssue`, `AudienceValidationResult`,
  `AudienceExplanation`.
* Schemas (Zod 4): `principalSchema`, `principalTypeSchema`, `attributeValueSchema`,
  `tenantRoleSchema`, `permissionSchema`, `customRoleSchema`, `segmentSchema`,
  `segmentNodeSchema`, `audienceSchema`, `audienceDeclarationSchema`, `audienceIdSchema`,
  `audiencesSectionSchema`, `surfaceSchema`; `audiencesJsonSchema()` and the committed
  `audiences.schema.json`.
* Functions: `matches`, `describe`, `validateAudiences`, `createAudienceRegistry`,
  `explainPrincipal`, `normalizeSegment`, `segmentDepth`, `referencedAudiences`,
  `deriveAudience`, `anonymousPrincipal`, `roleAtLeast`, `baseRoleOf`, `parsePermission`,
  `isPermission`, `isTenantRole`, `isAudienceId`, `isBuiltinAudienceId`,
  `defaultAudienceForSurface`, `isAudienceAllowedOnSurface`, and the `seg` builders.
* Constants: `AUDIENCE_MODEL_VERSION`, `PRINCIPAL_TYPES`, `TENANT_ROLES`, `TENANT_ROLE_RANK`,
  `PERMISSION_PATTERN`, `AUDIENCE_ID_PATTERN`, `SEGMENT_OPS`, `SEGMENT_MAX_DEPTH`,
  `BUILTIN_AUDIENCES`, `BUILTIN_AUDIENCE_IDS`, `BUILTIN_REGISTRY`, `SURFACES`,
  `SURFACE_AUDIENCES`, `WELL_KNOWN_ATTRIBUTES`, `DERIVED_AUDIENCE_FAMILIES`, `AUDIENCE_ISSUE_CODES`.
* Errors: `AudienceError`, `UnknownAudienceError`, `AudienceCycleError`, `AudienceValidationError`.

Consumers: PAP-59 (policy `audiences` field), PAP-116 / PAP-117 (spec validation), PAP-63
`AudienceFilter`, PAP-64 fixture principals, PAP-240 `testUsers`, PAP-195 behavioural segments,
PAP-103 agent principal attributes, PAP-35 / PAP-267 API context, PAP-136, PAP-141.

[Interface & Data Contracts §1]: https://linear.app/paperos/document/paperos-interface-and-data-contracts-d40e6a4d227c
