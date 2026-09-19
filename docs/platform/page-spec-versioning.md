# Page spec versioning (stub, PAP-114 → PAP-751)

`@paperos/spec` ships the **skeleton** of spec versioning and nothing more. This page names what
exists and what the follow-up issue (PAP-751, spec versioning tooling, deferred to v0.2) builds.

## What exists today (`packages/spec/src/migrate/`)

| Export | Does |
| -- | -- |
| `CURRENT_SPEC_VERSION = 1` | The only version. `meta.specVersion` missing is read as 1 with `SPEC_VERSION_MISSING`. |
| `SPEC_VERSIONS` | `[{ version: 1, schema: PageSpecSchema, codemodsFrom: {} }]`. PAP-740 appends `1.1`. |
| `Codemod` | `{ id, description, apply(doc: YAML.Document): Change[] }`. No implementations. |
| `Change` | `{ kind: rename \| move \| set \| remove, path, from?, to?, line?, col? }` for dry-run output. |
| `migrateSpec(doc, to = CURRENT_SPEC_VERSION)` | Identity for version 1; throws `SpecError` with `SPEC_UNSUPPORTED_VERSION` for any other version or unregistered target; never touches `x-*` keys or comments. |
| `readSpecVersion(doc)` | Reads `meta.specVersion` from a `yaml` Document. |

Unit tests: identity for v1, warning for a missing version, error for v2, `x-*` untouched
(`src/migrate/migrate.test.ts`).

## What PAP-751 builds (not here)

* Version registry with more than one entry and a walk from `from` to `to` applying each step's
  codemods (the loop is in `migrateSpec` already; it runs zero codemods today).
* Codemod helpers `renameKey | moveKey | mapEnum | wrapValue` over `yaml` Documents so comments and
  anchors survive.
* `paperos-spec migrate [--dry-run] [--to <version>]` in the PAP-115 CLI, printing `Change[]`.
* `x-deprecated` metadata on schema fields and rule `SPEC_DEPRECATED` (warn, error after a date).
* Weekly 300-fixture rehearsal (corpus from PAP-748): migrate, validate, diff, report.

## Rules until then

* A shape change bumps nothing silently: it is an ADR (PAP-130) and, if it is not additive, a new
  entry in `SPEC_VERSIONS` with a codemod.
* Additive v1.1 keys (`flags`, `modules`, `comments`, `help`, `seo`, `budgets`) keep
  `specVersion: 1` (PAP-740); consumers writing them early get `SPEC_RESERVED_KEY` warnings, not errors.
