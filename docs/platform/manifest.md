# Module manifest — field reference

Every PaperOS module is declared by one manifest. The kernel reads it at boot, CI reads it in
`pnpm --filter @paperos/core modules:validate`, the compatibility matrix and the dependency map are
generated from it, and the swap playbook checks its gates against it. It is the one data shape the
Module System hangs on.

* Schema: [`packages/core/src/modules/manifest.ts`](../../packages/core/src/modules/manifest.ts)
  (Zod 4), exported from `@paperos/core` and `@paperos/core/modules`.
* JSON Schema: `packages/core/src/modules/manifest.schema.json`,
  `$id https://paperos.dev/schema/module-manifest/1` — **generated**, never hand-edited.
* Prose and the module table: `docs/module-system.md` sections 1.1 and 1.2 in the plan repo.
* Decision: [ADR 0014](../adr/0014-module-manifest.md). Issue: PAP-433.

Written form: `packages/<module>/module.ts` calls `defineModule()`; the generated
`module.manifest.json` sits beside it and is what the CLI and the kernel read.

## Fields

Required: `id`, `kind`, `version`, `owner`, `provides`, `requires`, `swapRisk`. Everything else is
optional, and unknown fields fail — `additionalProperties: false`, because a typo in a manifest is
a bug you want at boot, not a field silently ignored.

| Field | Type | Meaning |
| -- | -- | -- |
| `id` | `^[a-z][a-z0-9-]+$` | Unique in a workspace. Matches the Linear project key for the seventeen product modules. |
| `title` | string | Human name. The UI reads the message catalog, never this. |
| `kind` | `runtime \| service \| tooling \| process \| kernel` | Same rules for a Postgres package and a CI pipeline. |
| `version` | semver | Version of the **implementation**, not of the contract. |
| `owner.agent` | one of the nine roster names | The only character that may bump the contract version. |
| `owner.project` | plan.json project key (or `module-system`) | Routes CODEOWNERS and the drift audit. |
| `provides[]` | `{ contract, version, impl }` | Contracts this module implements. `impl` defaults to `default`; two implementations of one contract differ here. |
| `requires[]` | `{ contract, range, optional, ports }` | Contracts this module consumes. `range` is a semver range; `ports` names what it actually calls. |
| `capabilities[]` | string | Free-form capability tags for the catalogue and the docs generator. |
| `slots.exposes[]` | `{ id, props, description }` | Extension points this module renders. |
| `slots.fills[]` | `{ slot, component, order, when }` | Contributions into someone else's slot. `when` is `can("…")` or `flag("…")`. |
| `events.publishes[]` / `.subscribes[]` | topic names | Topics declared in the publishing module's contract package. |
| `swapRisk` | `low \| medium \| high \| critical` | Declared, never computed: it picks the swap playbook. |
| `routes[]`, `navItems[]`, `entities[]`, `permissions[]`, `jobs[]`, `settingsSchema`, `integrations[]` | PAP-264 base fields | Optional; a `process` module has none of them. |
| `optional` | boolean, default `true` | `false` for a core module that cannot be disabled. |
| `dependsOn[]` | module ids | **Deprecated** (PAP-264). Derived from `requires`; when both are present they must agree. |
| `secrets[]` | string | PAP-444. Names only — never a value, never a `process.env` read. |
| `lifecycle` | `{ startupBudgetMs, healthIntervalMs, drainTimeoutMs }` | PAP-546. |
| `resilience` | `{ [port]: { timeoutMs, retries, backoff, circuitBreaker, fallback } }` | PAP-548, per port. |
| `issues[]` | `PAP-<n>` | PAP-439 dependency map: which issues own this module's edges. |

### semver, pre-1.0

`requires[].range` is an npm range and `^0.x` keeps its npm meaning: pre-1.0, **a minor bump is
breaking**. `^0.1.0` accepts 0.1.x and rejects 0.2.0. Every contract ships v0.1 during this build;
v1.0 is cut at the first release candidate that passes the shell-swap drill.

`optional: true` means the consumer boots without the provider and `kernel.resolve()` returns
`undefined`. An unresolved optional requirement is a **warning**, not an error, and an optional edge
is not an edge for cycle detection — the kernel can always boot without it.

## `defineModule()`

```ts
import { defineModule } from '@paperos/core/modules';
import { z } from 'zod';

export default defineModule({
  id: 'tables',
  kind: 'runtime',
  version: '0.1.0',
  owner: { agent: 'Nova', project: 'tables' },
  provides: [{ contract: '@paperos/contract-tables', version: '0.1.0' }],
  requires: [{ contract: '@paperos/contract-data-layer', range: '^0.1.0', ports: ['RepositoryPort'] }],
  swapRisk: 'high',
  settingsSchema: z.object({ pageSize: z.number().int().positive().default(50) }),
});
```

It validates the shape eagerly and throws with every problem listed, and its `const` type parameter
keeps the literals: `module.id` is `'tables'`, not `string`, so the kernel's typed tokens and
`ModuleSettings<typeof module>` resolve without a cast. `settingsSchema` may be a Zod schema (kept
usable at runtime) or a JSON Schema object; `toManifestJson()` converts the first into the second
for the generated `module.manifest.json`.

## `validateManifest(manifest, { others, contracts })`

Pure and synchronous — no file system, no network, no `process.env` — so it runs unchanged in a
Vite config, on the server, in the CLI and in the browser, which is what PAP-264 asks of
`loadModules`. Everything that needs the workspace is passed in: `others` are the sibling manifests,
`contracts` is what the caller could resolve about each contract package (its `version`, its
declared `topics` and `slots`).

It returns a `ManifestValidationResult` (`{ ok, diagnostics }`) — named that way because the
`@paperos/core` barrel also carries the filter grammar's `ValidationResult` (PAP-279) and one barrel
cannot hold two. It returns every diagnostic it finds rather than throwing on the first, because a
developer fixing a manifest wants the whole list. `validateManifests(all)` does the same for a whole
workspace.

### Diagnostic codes

Stable: CI output, the compatibility matrix and the swap CLI match on the code, never on the
message. A code is added, never renamed.

| Code | Severity | Fires when |
| -- | -- | -- |
| `SCHEMA_INVALID` | error | The manifest does not parse: a missing field, a bad enum, an unknown field. Nothing else is checked. |
| `OWNER_UNKNOWN` | error | `owner.project` is not a project key in `plan.json`. (`owner.agent` is an enum in the schema.) |
| `REQUIRES_UNRESOLVED` | error, or **warning** when `optional` | No module in the workspace provides the required contract. |
| `REQUIRES_RANGE_MISMATCH` | error | A provider exists but its version is outside the range. The message names both modules and both versions. |
| `DEPENDS_ON_DISAGREES` | error | An authored `dependsOn` differs from the set derived from `requires`. |
| `SLOT_UNKNOWN` | error | `slots.fills[].slot` is a slot no module exposes (and no contract declares). |
| `TOPIC_UNDECLARED` | error when the contract's topics were read, **warning** when the package was found but its topics were not | A published topic the module's own contract package does not declare. A contract the caller passed no information about is not checked at all, so the rule stays silent instead of warning on every module before the contract packages land. |
| `CYCLE` | error | A non-optional dependency cycle through this module. `related` is the whole path, `a -> b -> a`. |
| `DUPLICATE_PROVIDER` | error | Two modules (or one manifest twice) provide the same contract under the same `impl`. Two implementations that differ in `impl` are fine. |
| `PROVIDES_VERSION_MISMATCH` | error | `provides[].version` differs from the contract package's `package.json` version, when the package is resolvable. |

## `pnpm --filter @paperos/core modules:validate`

Finds every `module.manifest.json` in the workspace (skipping `node_modules`, `dist`, `coverage`,
`.turbo`, `.git` and `fixtures`), validates the set and prints one row per module: id, kind,
provides count, requires count, swap risk, status and file. Exit 0 when there is no error, 1
otherwise.

`fixtures` is skipped so the eighteen goldens do not masquerade as real modules once the real ones
land — they would collide on `DUPLICATE_PROVIDER`. While **no** module ships a manifest yet the CLI
falls back to the goldens and says so in its summary line, which is what makes the table below
appear on today's workspace.

```
MODULE         KIND     PROV  REQ  SWAP RISK  STATUS  FILE
-------------  -------  ----  ---  ---------  ------  ----
tables         runtime  1     4    high       ok      packages/core/src/modules/fixtures/modules/tables/module.manifest.json
...
18 manifests, 0 errors, 0 warnings.
```

`--json` prints the same thing as machine-readable JSON. `--root <dir>` validates another
workspace. `--fix` is reserved for PAP-552 and today prints a "not wired yet" line and exits 1.

## Golden fixtures

`packages/core/src/modules/fixtures/modules/<id>/module.manifest.json` holds the eighteen golden
manifests — the seventeen modules of `docs/module-system.md` table 1.1 plus the `module-system`
kernel — with the provides and requires of that table. They are real manifest files parsed by the
same code that will read real modules, and they are the worked examples every
`Publish @paperos/contract-<module>` issue copies.

Three of table 1.1's `requires` edges are marked `optional: true` because the table's graph is
cyclic as written and the kernel has to boot something first:

| Edge | Why optional |
| -- | -- |
| `data-layer` → `identity` | identity's repositories are data-layer's; data-layer only needs the principal for the permission predicate. |
| `app-shell` → `spec-builder` | the shell renders without generated pages; spec-builder needs the shell's slots. |
| `forge` → `quality` | the git service boots without the gates; the gates call the forge. |

The kernel provides `@paperos/contract-module-system` rather than `@paperos/kernel`: `provides[]`
is a list of *contracts* (`@paperos/contract-*`), and `@paperos/kernel` is the kernel's
implementation package. Table 1.1's "Provides" column names the package, not the contract.

`fixtures/invalid/` holds one deliberately broken manifest per diagnostic code, described in
`cases.json` with the code it must produce and the inputs that reproduce it. The unit test asserts
each one fails with **exactly** its code, so a new rule cannot quietly widen an old fixture.

## Generating the JSON Schema

`pnpm --filter @paperos/core gen:schemas` writes `manifest.schema.json`. The committed copy is
drift-checked by `manifest.schema.test.ts`, which also compiles it with ajv and validates the
eighteen goldens against it, so the JSON Schema and the Zod schema cannot disagree.
`manifest.ts` is held at 100% coverage by `pnpm --filter @paperos/core test:coverage`, a second
Vitest pass scoped to `src/modules` that `test` chains, so v8's instrumentation never perturbs a
sibling folder's timing budget. The two differ
in exactly one place: `version` and `range` are `type: string` in JSON Schema and a real semver
parse in Zod. Biome does not format the generated file (`packages/core/biome.json` excludes it) so
that generating it never fails the linter.
