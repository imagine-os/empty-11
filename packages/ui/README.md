# @paperos/ui

Design-system components with registered ids (owner: design-system / Iris; PAP-66, PAP-67, PAP-74).

Wired but empty. Today it exports `TEMPLATE_TITLE`, the only user-visible string of the
placeholder page — editing it while `pnpm dev` runs is the hot-reload demo.

Rules: no business logic, no data fetching, no module imports other than `@paperos/core` and
`@paperos/contract-*`. Every component registers an id so specs and the actions registry can
reference it.
