# @paperos/agents

Character schema, handoff artefacts, session status and agent runtime ports. Owner: agents (Atlas),
PAP-103 and PAP-108.

## Character schema (PAP-103, ADR 0020)

`src/schema/` is the one typed shape every Claude character is declared in. Import it as
`@paperos/agents/schema`.

```
src/schema/character.ts    CharacterSchema, RosterSchema (Zod 4, strict) and their types
src/schema/scopes.ts       access-scope registry: resource:verb[:qualifier], classes
src/schema/tools.ts        known tools, permission-rule grammar, lastVerified
src/schema/models.ts       price-table model ids, efforts (xhigh alias), permission modes
src/schema/skills.ts       skill ids until PAP-105 ships skills.json
src/schema/mcp-catalog.*   PAP-210 catalog reference; the .stub.json is replaced by PAP-210
src/schema/validate.ts     validateRoster(): 17 error codes, 5 warning codes
src/schema/inherit.ts      resolveInheritance(): own -> parent -> roster defaults
src/schema/load.ts         YAML loading: roster.yaml + characters/*.yaml
src/schema/json-schema.ts  z.toJSONSchema wrappers
schema/*.schema.json       generated (pnpm gen:schemas), drift-tested, never hand-edited
fixtures/valid/            golden roster: nine leads, 28 subs, resolved roster.json (generated)
fixtures/invalid/          one file per error code, `# expect: CODE` header
fixtures/source/           plan.json agents[] copy for convert:plan
scripts/                   validate, gen-schemas, gen-fixtures, convert-plan (node, type-stripped)
```

Commands (from the repo root): `pnpm --filter @paperos/agents validate|gen:schemas|gen:fixtures|convert:plan`.
Reference: [`docs/platform/character-schema.md`](../../docs/platform/character-schema.md).

## Live roster (PAP-284)

`roster.yaml` and `characters/<name>.yaml` are the roster the platform runs: nine leads, 28 subs,
validated by the schema above. `src/roster/` holds the plan.json converter (`convertPlan`,
`mergeCharacter`, `characterDrift`), the org tree (`renderTree`, `diffAgainstPlan`), the policy
constants and the live-roster loader; import it as `@paperos/agents/roster`.

```
roster.yaml                defaults per kind (model, fallback, effort, mode, budget, memory), 700 USD allowance
characters/<name>.yaml     one character per file; plan-owned fields + hand-completed rest
src/roster/                plan.ts, policy.ts, convert.ts, tree.ts, live.ts and their tests
scripts/plan-to-roster.ts  convert plan.json agents[]; --merge keeps hand edits, --check names drift
scripts/tree.ts            print the org tree, diff against plan.json; --check for CI
fixtures/plan-to-roster.snapshot.yaml   converter output snapshot (Vitest toMatchFileSnapshot)
```

Commands: `pnpm --filter @paperos/agents validate` (live roster, then fixtures), `tree [--check]`,
`plan-to-roster [--merge|--check|--force|--dry-run]`. Reference:
[`docs/platform/roster.md`](../../docs/platform/roster.md).

`src/rubric/library-rubric.json` is the machine-readable library rubric (PAP-209).
