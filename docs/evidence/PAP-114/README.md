# Evidence — PAP-114 page spec schema

## Checks (all green before push)

* `pnpm check` (Turborepo lint + typecheck + test + build across the workspace).
* `packages/spec` Vitest: fixture corpus (5 valid, 13 invalid with `*.expected.json` codes, line and
  col), 40-seed property round-trip `parseSpec(stringify(spec))`, `expectTypeOf` contract types,
  JSON Schema and doc drift, registry helpers, migration skeleton.
* `pnpm --filter @paperos/spec gen:schemas` is idempotent (`gen:schemas:check` exits 0 on a clean tree).

## Demo (under one minute)

```sh
pnpm --filter @paperos/spec parse fixtures/invalid/dup-key.spec.yaml
# error   SPEC_DUP_KEY   fixtures/invalid/dup-key.spec.yaml:9:3  meta.route
#         key `route` is declared twice (lines 5 and 9) (also line 5)
pnpm --filter @paperos/spec parse fixtures/valid/customer-invoices.spec.yaml
# ok      ... meta.id=customer-invoices status=ready (0 warning(s))
```

## VS Code completion

The Definition of Done asks for a screenshot of completion on `layout.template`. This session ran
headless without a display, so no screenshot was captured; **open item for the review pass**. To
reproduce: install the Red Hat YAML extension, open
`packages/spec/fixtures/valid/customer-invoices.spec.yaml` (its first line is
`# yaml-language-server: $schema=../../schema/page.spec.schema.json`), delete the value of
`layout.template` and trigger completion: `app`, `public`, `focus`, `kiosk` with their description.
The JSON Schema is draft 2020-12 with `$defs` for every named type, `enum`, `pattern`, `default` and
`description` on every field, which is what the extension renders.
