# docs/security

Threat model (ADR 0024 / PAP-219), the hardening baseline every app inherits, the incident
playbook, secrets handling, dependency and license policy, and review notes. No secret value ever
lands in this repository: `.env.example` holds placeholder names only, and anything that needs a
real credential is a "Needs Justin" item.

| File | Holds | Read it when |
| -- | -- | -- |
| [`threat-model.md`](threat-model.md) | STRIDE per trust boundary (B1..B10), the deny-list rationale, prompt-injection tiers, the gap register, standards with dates | you are adding a route, table, shape, job, room, MCP tool or provider |
| [`hardening-baseline.md`](hardening-baseline.md) | headers, CSP, CSRF, cookies, CORS, rate limits, the twenty secret classes and their rotation runbooks, dependency policy, the `securityHeaders()` contract | you are wiring an app, a header, a cookie or a limit — or rotating a secret |
| [`incident-playbook.md`](incident-playbook.md) | severities, paging, first fifteen minutes, evidence, containment per boundary, the 72-hour checklist, post-mortem template | something is on fire, or you are running a drill |
| [`../../ops/security/controls.yaml`](../../ops/security/controls.yaml) | every control with an id, boundary, verification mode, owner and issues | you need to cite a control in a finding, a rule or a rubric |
| [`../../ops/security/agent-deny.yaml`](../../ops/security/agent-deny.yaml) | destructive actions agents may not take, with backstops and mode exceptions | a tool call was denied, or you are extending the hook |
| [`../../ops/security/headers.json`](../../ops/security/headers.json) | the header, CSP, CORS, cookie and limit baseline as data | an app, edge or Tauri config needs the values |

Check the three data files with `node scripts/security-controls.ts --check`; list what a lint rule
is meant to catch with `node scripts/security-controls.ts --verify lint`. Post-mortems land in
`post-mortems/`, drill timings in `drills.md`, incident evidence in `../evidence/INCIDENT-<date>-<n>/`.
