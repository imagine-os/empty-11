# @paperos/tokens

Design tokens (owner: design-system / Iris; PAP-66). DTCG JSON source in `tokens/`, compiled to
CSS custom properties, a Tailwind v4 draft and typed TS exports. See
[`docs/platform/design-tokens.md`](../../docs/platform/design-tokens.md) for the full contract and
[`docs/adr/0018-design-tokens.md`](../../docs/adr/0018-design-tokens.md) for why it's built this
way.

```
pnpm --filter @paperos/tokens build         # compile tokens/*.json -> src/generated/*
pnpm --filter @paperos/tokens build:check   # CI: fail if generated output is stale
pnpm --filter @paperos/tokens tokens:lint   # schema, alias resolution, cycles, unused primitives
pnpm --filter @paperos/tokens tokens:check  # WCAG contrast across light/dark/hc
pnpm --filter @paperos/tokens ramps         # print a fresh OKLCH ramp for hand-review
```

Rules: no business logic, no React, no database. Never edit `src/generated/*` by hand (regenerate
with `build`); never reference `core.tokens.json` primitives from a component (use the semantic
layer or a theme file); never hard-code a colour, size or motion value anywhere else in the
platform — add or reuse a token instead.
