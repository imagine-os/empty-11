# packages/contracts

One folder per module, published as `@paperos/contract-<module>` (Module System §2).
The workspace glob `packages/contracts/*` and the alias `@paperos/contract-*` are already wired,
so a contract package is added with no root edit.

A contract package may contain **only**: TypeScript types and Zod 4 schemas, `defineTopic()` event
definitions, oRPC route signatures (no handlers), UI slot definitions, port interfaces, a
`conformance/` suite and `fixtures/`, and pure helpers with no I/O.

Banned: React components, Drizzle tables, network calls, environment reads (lint rule R9).
A contract may import `@paperos/core/*` and other contract packages, nothing else; the graph must
stay acyclic.

Nothing here yet — PAP-433 onwards land the manifests and the per-module contracts.
