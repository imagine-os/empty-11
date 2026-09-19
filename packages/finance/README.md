# @paperos/finance

Finance module port types — no runtime, no provider SDK, no React. Today this holds the
`PayrollProvider` port (`src/payroll/provider.ts`) decided by ADR
[0007-payroll-provider](../../docs/adr/0007-payroll-provider.md) (PAP-176), which PAP-184's adapter
children implement and PAP-186's `upcomingPayroll` reads events from. `Money` is defined locally
here (a subset of `packages/core`'s eventual shared value type, PAP-302/ADR 0011, not yet merged)
with the same field shape (`amountMinor: bigint`, ISO 4217 `currency`) so a future swap to
`@paperos/core`'s `Money` is a type-compatible import change, not a rewrite.

Module boundary: this package is the finance module's contract surface. Adapters (PAP-398) and the
rest of the finance module import from here; nothing here imports a provider SDK or another
module's implementation package.
