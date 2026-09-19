<!-- GENERATED from packages/contracts/quality/src/rubrics/security.json by packages/contracts/quality/scripts/build-docs.ts. Edit the JSON, then run `pnpm --filter @paperos/contract-quality build:docs`. -->

# Security rubric (`RUB-SEC-*`, v1)

Applied by: `security`. Severity names and the gate rule: [severity.md](./severity.md). Finding shape: [finding.schema.json](./finding.schema.json).

## Purpose

Find the authorisation, tenant-isolation, secret and injection mistakes the scanners cannot see, and cite the PAP-219 `SEC-*` control every finding enforces. The security reviewer (PAP-245) embeds this rubric and reads PAP-80 `security.json` as its baseline, so scanner hits are referenced, never duplicated.

## Scope

Every trust boundary in the Security & Threat Model §3 (B1 browser to B9 agent sessions) touched by the diff: oRPC procedures, Drizzle queries, auth and session code, file handling, outbound requests, logging, dependencies, agent tool configuration.

## Controls

Control ids follow PAP-219 `controls.yaml` (`SEC-<AREA>-<nn>`). `SEC-API-01` (authorize on every procedure) and `SEC-DB-02` (queries inside withTenant) are fixed by PAP-80's rule set; other ids below are the areas this rubric expects PAP-219 to bind and are re-pointed when `controls.yaml` lands.

## Examples by severity

- **S0**
  - A new oRPC procedure has no `authorize()`; any signed-in user can call it.
  - A Drizzle query runs outside `withTenant`, so RLS context is unset and rows from another tenant come back.
- **S1**
  - A mutating route accepts a body without a Zod schema.
  - A user's email and IP are logged at info level on every request.
- **S2**
  - Rate limit missing on a read endpoint that is already bounded by `limit <= 100`.
  - A dependency added for one helper function widens the supply-chain surface.

## Checklist

Each item is a question the reviewer answers with `checked`, `n/a` or `skipped` in `rubricCoverage`, so silence differs from a skipped check. Typical severity is the starting point; the [severity taxonomy](./severity.md) and its caps decide.

| ID | Item | Test | Typical | Controls | How to verify | False positives |
|---|---|---|---|---|---|---|
| `RUB-SEC-01` | Authorisation on every procedure | Can I call a new or changed procedure, route, job trigger or server action as a user without the required permission and succeed? | S0 | `SEC-API-01` | Every procedure in the diff calls `authorize()` / `can()` with the permission the spec's Access section names before any read or write; run the PAP-64 permission matrix for changed procedures. | Public procedures explicitly marked `public` in the spec's Access section; UI-only `useCan` gating is never sufficient (B1 elevation). |
| `RUB-SEC-02` | Tenant isolation and RLS context | Can I craft an id, filter or join that returns or mutates a row from another tenant, or run a query with no tenant context so RLS fails open or bypasses? | S0 | `SEC-DB-02` | Every Drizzle call sits inside `withTenant`; no `app.bypass` outside the migrator; ids from the client are scoped by tenant in the `where`; the PAP-34 cross-tenant harness covers new tables. | Tables declared tenant-less in the schema barrel (system configuration) with a comment saying so. |
| `RUB-SEC-03` | Input validation and mass assignment | Can I send an extra, oversized, wrongly typed or nested field and have it stored, spread into an update, or crash the handler? | S1 | `SEC-API-02` | Inputs are Zod objects with `.strict()` or an explicit pick before `db.update(...).set()`; string lengths and array sizes are bounded; `limit <= 100`. | Internal calls whose input type is produced by our own code with no client boundary. |
| `RUB-SEC-04` | Secrets in code, config and bundles | Can I find a credential, token, private key or `sk_live_` literal in the diff, in a client-side bundle (non-`VITE_` var), in a fixture outside `__fixtures__`, or in a committed `.env`? | S0 | `SEC-SECRETS-01` | Read gitleaks output in `security.json`; grep the diff for key shapes; confirm new config reads go through the config port (PAP-444) and `.env.example` carries placeholders only. | Documented fake fixtures under `**/__fixtures__/**` matching the PAP-80 pattern; public keys. |
| `RUB-SEC-05` | SSRF and outbound requests | Can I supply a URL, host or webhook target that makes the server fetch the tailnet, cloud metadata, localhost or an arbitrary host? | S1 | `SEC-NET-01` | Outbound fetches take hosts from an allowlist or a stored, admin-set connector record; user-supplied URLs are resolved and checked against private ranges before use; redirects are capped. | Fetches to fixed first-party hosts from constants. |
| `RUB-SEC-06` | Injection (SQL, HTML, shell, template, path) | Can a user-controlled string reach `sql.raw`, `dangerouslySetInnerHTML`, `exec`/`spawn` arguments, a template engine, a file path or a LIKE pattern unescaped? | S0 | `SEC-INJ-01` | Trace every interpolation in the diff to a parameterised call, `dompurify`, an argument array or a path normalisation with a root check. | Interpolation of values the code produced itself (enum names, column identifiers from a fixed map). |
| `RUB-SEC-07` | File uploads and downloads | Can I upload a file with a spoofed content type, an oversize body, a path-traversal name or an SVG with script, or download another tenant's object by guessing its key? | S1 | `SEC-FILES-01` | Uploads go through `packages/files` with size and type sniffing; object keys are tenant-prefixed and served via signed URLs; SVG and HTML are served as attachments. | Files written by the server itself from trusted generators. |
| `RUB-SEC-08` | Rate limits and abuse | Can I loop a new mutating or expensive endpoint (login, invite, export, search, AI call) without hitting the 600/min actor limit or a tighter per-route limit? | S2 | `SEC-API-03` | Expensive or unauthenticated routes declare a limiter; login and token endpoints use the tighter identity limiter; k6 budget exists (PAP-242). | Routes covered by the global limiter whose cost is bounded (`limit <= 100`, indexed read). |
| `RUB-SEC-09` | Dependency and supply-chain risk | Does the diff add a dependency, GitHub Action, container image or install script that widens the supply chain more than the feature needs, or pin nothing? | S2 | `SEC-SUPPLY-01` | New packages are justified in the PR body (PAP-209 rubric for libraries), actions pinned by SHA, images by digest; OSV results in `security.json` reviewed; licence hook passes. | Dev-only tooling already in the approved stack list (ADR 0001). |
| `RUB-SEC-10` | Sensitive data in logs, errors and telemetry | Can I find PII, tokens, request bodies, card or bank shapes, or other tenants' identifiers in a log line, thrown error message, OTel attribute or Linear comment the code emits? | S1 | `SEC-LOG-01` | Logging calls use the redacting logger with structured fields; error messages returned to clients carry codes, not internals; OTel drops PII (PAP-40). | Opaque ids (uuidv7) and tenant ids inside the tenant's own audit log. |
| `RUB-SEC-11` | Untrusted content reaching an agent | Can text from a PR diff, issue body, imported document, web page or scanner (tiers T2 to T4) reach an agent's instruction section without an `<untrusted source= tier=>` wrapper, or can a non-Justin comment trigger `approve`? | S0 | `SEC-AGENT-01` | Prompt assembly wraps every tier T2+ input; actor id is verified for T1; reviewers run read-only without MCP on fork PRs (Threat Model §6). | Content rendered for a human only, never fed to a model. |

## What this rubric does not cover

- Vulnerable dependency versions, leaked secrets in history and SAST patterns: PAP-80 scanners report those as `from: scanner`; the reviewer only adds what they missed.
- Threat model completeness and control wording (PAP-219).
- Penetration testing and DAST (PAP-357).
