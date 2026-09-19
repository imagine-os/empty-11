---
id: "0017"
title: "Audience model: Principal, roles, segments and named audiences"
status: Accepted
date: 2026-09-19
deciders: ["Quill", "Forge"]
issue: PAP-55
supersedes: []
supersededBy: null
tags: ["contract", "identity", "spec"]
reviewDate: null
---

# 0017. Audience model: Principal, roles, segments and named audiences

* Status: Accepted
* Date: 2026-09-19
* Issue: [PAP-55](https://linear.app/paperos/issue/PAP-55)
* Deciders: Quill (document), Forge (schema); Sentinel and Atlas (review)

## Context

Seventeen projects need to say *who* a thing is for: page specs (`access`), policies (PAP-59),
views (`AudienceFilter`, PAP-63), notifications, campaigns (PAP-195), fixtures (PAP-64, PAP-240)
and the agent runtime (PAP-103). Without one vocabulary each of them writes free text ("staff",
"admins and owners", "pro users") and the spec validator cannot tell a typo from a new audience.
Interface & Data Contracts §1 already fixes the actor shape (`Principal = { id, type:
'human'|'agent'|'service'|'anonymous', tenantId, attributes }`) and §2 names the five base roles;
PAP-55 is the provider of both. The Module System puts the shape in `packages/core/src/audience/`
(identity-owned sub-folder of the app-shell-owned core) because every contract package, including
`contract-identity`, must be able to import it without a runtime dependency.

Constraints: pure TypeScript (no React, no database, no env), Zod 4 as the schema language with
JSON Schema generated, `matches` under 50 µs so policies can call it per row, English + Spanish
UI (so explanations are developer-facing, not user copy), and parallel sessions landing sibling
folders (`types/`, `filter/`, `events/`, `modules/`) in the same package the same day.

## Decision

We will ship the audience model as `@paperos/core/audience`, version `AUDIENCE_MODEL_VERSION = 1`,
with these fixed points:

1. **`Principal`** is `{ id, type, tenantId: string | null, attributes: Record<string, string |
   number | boolean | string[]> }` with `PrincipalType = 'human' | 'agent' | 'service' |
   'anonymous'` in that order. PAP-302's `ActorRef` is its projection and imports the enum; PAP-35,
   PAP-57, PAP-60 import rather than redefine. One principal per active tenant.
2. **Roles**: `TenantRole = 'owner' | 'admin' | 'staff' | 'member' | 'viewer'`, ranked 5..1;
   custom roles are kebab-case names that `extends` one base role. **Permissions** are
   `resource:action` strings (`PERMISSION_PATTERN`: lowercase dot-namespaced resource, lowercase
   verb or `*`); this module owns the grammar, PAP-59 owns evaluation.
3. **Segments** are `{ all } | { any } | { not } | { attr, op: eq|neq|in|gte|lte|exists, value? }`
   with shorthands `{ role }`, `{ tier }`, `{ principalType }`, `{ audience: id }`, depth ≤ 6.
   Missing attributes are `false` (never a throw); arrays match any element for `eq` and intersect
   for `in`; comparisons are same-typed. Audience references are resolved by a registry and
   cycle-checked; `matches` throws only `UnknownAudienceError` / `AudienceCycleError`.
4. **Audience ids** are kebab-case segments joined by dots. The fifteen built-ins keep the spec's
   single kebab-case ids (`customer-pro`, `staff-support`); the dotted form is reserved for
   derived families `customer.<tier>`, `staff.<staffRole>`, `agent.<character>`
   (`deriveAudience`), so a derived id can never shadow a built-in.
5. **Built-ins**: `everyone`, `anonymous`, `authenticated`, `customer`, `customer-free`,
   `customer-pro`, `customer-enterprise`, `staff`, `staff-support`, `staff-finance`, `admin`,
   `owner`, `partner`, `agent`, `developer`. Owners are admins. `customer` and `staff` are
   *humans* with a `tier` / `staffRole`; agents never inherit an audience through `actingFor`.
   Apps cannot redeclare a built-in.
6. **Surfaces**: `website | app | staff | admin | docs | ops | dev | testing | agent | api`, each
   with a default audience and the built-ins a page there may narrow to. PAP-114 uses this enum
   for `PageSpec.surface`.
7. **`app.spec.yaml` `audiences:`** is `Record<AudienceId, Omit<Audience, 'id'>>`; the JSON Schema
   is generated from Zod into `audiences.schema.json` and CI fails when it is stale.
   `validateAudiences` reports `INVALID_ID | SHADOWS_BUILTIN | INVALID_SEGMENT | TOO_DEEP |
   UNKNOWN_REFERENCE | CYCLE` with paths.
8. **`describe`** renders English developer-facing phrases and is locked by a golden file; it is
   not user copy and is not localised.

Dependencies added to `packages/core`: `zod ^4.6.5` (runtime; the platform's schema language per
Contracts §1), `fast-check` and `vite-node` (dev). None is in the workspace `catalog:` yet; moving
them there is a root-file follow-up for app-shell.

## Consequences

**Positive.** Specs validate against real ids instead of free text; one `Principal` shape ends
the `user.kind` / `principalType` / `actor.type` drift before it starts; policies, views and
campaigns share one evaluator with laws proven by property tests (double negation, De Morgan,
`all([])` is everyone); fixtures come with the model.

**Negative.** The English `describe` output is a second surface to keep stable (golden file);
`role` living in `attributes` means PAP-58 must set it consistently; `tier` and `staffRole` as
plain attributes put the meaning of "customer" and "staff" in data rather than in a type, which
is deliberate (apps map their own plans) but needs the doc's table to stay authoritative. Every
shape change here is an ADR.

**Neutral.** `zod` becomes a runtime dependency of `@paperos/core`; sibling folders (filter,
events, types) were going to add it the same day. The `Surface` enum lives here rather than in
`packages/spec` because the mapping to audiences is the decision; the spec package imports it.

## Alternatives rejected

* **`FilterTree` from `@paperos/core/filter` (PAP-279) as the segment language.** Attractive for
  uniformity, but `FilterTree` targets rows and SQL, is landing in parallel, and audiences need
  audience references, shorthands and cycle detection that a row filter has no reason to carry.
  PAP-195 may bridge the two by compiling a `Segment` to a `FilterTree`. The one fact that would
  change the answer: `FilterTree` growing a reference node with a resolver.
* **Dotted ids for the built-ins (`customer.pro`).** Closer to the derived-family grammar, but the
  Linear spec names the kebab-case built-ins and nine consumers already cite them. Kept kebab for
  built-ins; dots reserved for derived ids.
* **A branded `AudienceId` type.** Safer, but every consumer would need a cast to write a literal
  in a page spec or a policy; the grammar is enforced at the boundaries instead (`audienceIdSchema`,
  `validateAudiences`).
* **`matches` returning `false` on an unknown or cyclic reference.** Silent, and it would hide a
  broken registry in production. It throws a typed error; the registry validates ahead of time.
* **A hand-written JSON Schema.** Contracts §1 rules it out: Zod is the source, JSON Schema is
  generated, a test keeps the committed copy fresh.
* **Roles as a separate `principal.role` field.** Tidier types, but the contracts fix `Principal`
  to four fields and a multi-tenant user's role is per tenant like every other attribute.

## Re-open criteria

- **Fact.** PAP-58 cannot map the five base roles one-to-one onto Better Auth organization roles.
- **Fact.** PAP-195 needs an operator the six cannot express (regex, date windows, counts) and
  compiling `Segment` to `FilterTree` is not enough.
- **Budget.** `matches` at depth 6 measures over 50 µs median on the CI runner.
- **Fact.** A consumer needs a localised `describe`; then the phrases move to the message catalog
  and this ADR is superseded.

## References

- Linear issue: PAP-55
- Platform doc: `docs/platform/audiences.md`
- Code: `packages/core/src/audience/`, fixtures and goldens under `fixtures/`
- Contracts: Interface & Data Contracts §1, §2 (Membership / Role, Agent principal), §6
  (`Principal` and audiences); Module System row identity
- Related ADRs: 0011 shared-value-types (`ActorRef`), 0012 filter-grammar, 0015 page-spec-schema
