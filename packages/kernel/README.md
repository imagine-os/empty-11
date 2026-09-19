# packages/kernel (stub)

`@paperos/kernel`: the only place a cross-module dependency is allowed to live — module registry
and DI container (PAP-434), flag-based swap (PAP-435), event-bus wiring, gateway (PAP-437),
UI slots runtime (PAP-438), conformance runner and swap CLI.

Rule R10: the kernel imports `@paperos/core` and `@paperos/contract-*`, never a module
implementation. Apps compose modules through the kernel only.

Stub: PAP-434 creates the package here.
