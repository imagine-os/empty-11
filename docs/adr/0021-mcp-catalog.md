---
id: "0021"
title: "One catalogue for every MCP server, with destructive tools held by Atlas alone"
status: Accepted
date: 2026-09-19
deciders: ["Atlas", "Sentinel"]
issue: PAP-210
supersedes: []
supersededBy: null
tags: ["agents", "security", "library"]
reviewDate: 2026-12-18
---

# 0021. One catalogue for every MCP server, with destructive tools held by Atlas alone

* Status: Accepted
* Date: 2026-09-19
* Issue: [PAP-210](https://linear.app/paperos/issue/PAP-210)
* Deciders: Atlas (decision), Sentinel (Security Auditor, review)
* Review date: 2026-12-18

## Context

Twenty parallel Claude sessions will call MCP servers on our behalf, against a Linear workspace
that is the system of record, a forge that holds every line of code, and — later — a Stripe
account and a production database. A session decides what to call from its own context, which
means the only reliable place to stop a bad call is before the session starts: in the list of
tools it was handed.

Three forces:

* **A tool list is a permission grant.** [Security & Threat Model](../security/README.md)
  section 4 names three enforcement points for the deny list, and one of them is "removal of
  `destructive`-scoped MCP tools from every character except Atlas". That sentence only means
  something if there is a machine-readable list of which tools are destructive. There was not.
* **Credentials must not enter sessions.** Threat Model section 5 puts `broker:*` placeholders
  in sessions and the real credential in the egress proxy. A catalogue is the natural place for
  a credential to leak into a repo, so it is the natural place to check that one has not.
* **Nothing can wait on Justin.** Most of these vendors need an account he has not created. A
  catalogue that only lists servers we can already reach would be four entries long and would
  teach the next session nothing.

What we already decided that this has to fit: ADR 0002 makes Forgejo the forge of record and
GitHub the mirror; ADR 0009 says every adoption question is answered with the PAP-209 rubric and
a scorecard, and nothing else. Facts below were verified on 2026-09-19 and are cited in
[`docs/platform/mcp-catalog.md`](../platform/mcp-catalog.md) section 1; anything unverified is
written `unknown` or marked `source: "inferred"` in the catalogue.

## Decision

We will keep one hand-written catalogue, [`.claude/mcp/catalog.json`](../../.claude/mcp/catalog.json),
with eleven servers, and treat it as a control rather than a document.

Specifics:

1. **Every tool carries a scope class** — `read`, `write` or `destructive`. A missing class is a
   schema error, never a default, because a default reads as "harmless" and the tools that hurt
   are the ones nobody classified.
2. **`destructive` reaches Atlas and nobody else**, and Atlas holds none by default: a
   destructive-capable server is granted for one session through a `scope:+<name>` label and a
   PAP-94 approval card. The rule is checked twice from two independent sources — the scope
   classes and the per-server `destructiveTools` name list — so a tool cannot pass by being
   misclassified in one of them.
3. **Auth is declared as broker placeholders only**, `broker:<service>/<credential>`. Every
   string in the catalogue and in every character fragment is scanned for credential shapes on
   each `pnpm check`. `broker:stripe/restricted-key-test` exists; a live-mode counterpart does
   not and will not.
4. **Nine per-character fragments**, `.claude/agents/<character>/mcp.json`, are real Claude Code
   `.mcp.json` bodies. A character outside a server's `writeCharacters` is pointed at the
   vendor's read-only endpoint where one exists, so least privilege is enforced by the URL and
   not only by the tool filter. A fragment may only wire a server marked `adopted`.
5. **The rubric applies, with two domain extras.** `scopeSafety` (weight 10) and `headlessAuth`
   (weight 5) are declared in the catalogue, anchored 0-4, and applied to all eleven servers —
   never invented for one. `bundle`, `a11y` and `ts` are `n/a` for almost every entry and
   rescale per rubric section 1. The `webviewIncompatible` and `vendorNoSelfHost` gates do **not**
   apply: an MCP server is agent tooling, not code shipped inside a PaperOS deployment, so
   nothing reaches a Tauri WebView and nothing is hosted for a customer. `licenseTier`, `noTypes`
   and `openAdvisory` still apply.
6. **Rejected servers stay in the file** under `denied`, with their evidence, so the next
   session does not re-litigate them.
7. **The validator lives in `packages/agents/src/mcp/`** (Zod 4 schema, rubric arithmetic,
   twenty-one rule tests plus seventeen catalogue conformance tests) and runs inside `pnpm check`.
   The stored rubric total is recomputed from the scores on every run, so a number in the file
   can never drift from what it claims to summarise.

## Consequences

**Positive.** The deny list's second enforcement point exists and is tested. A session's tool
surface is derivable from one file rather than from nine hand-maintained configs. A new server
costs one catalogue entry and the checker tells you what is missing. The three servers that most
sessions will actually call — Linear, GitHub, Playwright — boot from a fresh clone with no
account setup beyond the broker.

**Negative.** The catalogue is hand-written, so it drifts from reality the moment a vendor
renames a tool, and nothing in this pass detects that: the checker is static and never touches
the network. Four servers carry `source: "inferred"` tool names that no live `tools/list` has
confirmed. The `aliases[]` field and the thirty-day rename window PAP-210's spec describes are
declared in the schema but not yet enforced. All of this is `pnpm mcp check`, and it is a
follow-up rather than part of this decision.

**Neutral.** `packages/agents` gains `zod` as its first runtime dependency and switches its
tsconfig to the node preset, because the loader reads files. The version is pinned in the
package rather than in the workspace `catalog:` block, since that root file has one owner in
wave 0; moving it to the catalog is a follow-up for whoever adds the second Zod consumer.

## Alternatives rejected

**Per-character `.mcp.json` files with no catalogue.** The obvious thing, and what the repo
would have drifted into. It loses the one property that matters: there is no single place that
says a tool is destructive, so the rule in Threat Model section 4 stays prose. Rejected. What
would change the answer: nothing — the catalogue costs one file and buys the check.

**Generating the fragments from the catalogue instead of checking them.** Tempting, and it is
where PAP-106 goes. Rejected here because generated bundles need the `settings.json` and
`hooks.json` beside them to be worth generating, and that is PAP-106's job. Checking is the
subset that is useful on its own today.

**A thin in-repo Forgejo MCP wrapper.** PAP-210's spec asks for one, with five tools over the
`@modelcontextprotocol/sdk`. Since the spec was written, a first-party
`code.forgejo.org/forgejo/forgejo-mcp` exists, alongside four community implementations. Writing
our own now would commit us to maintaining a fifth before we have an instance to point it at
(PAP-47, and Hetzner is a Needs Justin item). Deferred to a follow-up, with the official server
catalogued as a `candidate` scoring 45 and wired to nobody. What would change the answer: the
official server's SPDX expression read from a release artefact and a Forgejo instance to test it
against — the two facts that cap its `license` score at 1 today.

**The archived `@modelcontextprotocol/server-postgres`.** Still the most-installed Postgres MCP
server and still carrying the SQL injection it was archived for: it wraps queries in a read-only
transaction but accepts semicolon-separated statements, so `COMMIT; DROP SCHEMA public CASCADE;`
escapes the transaction. `denied`. Superseded by Crystal DBA's `postgres-mcp`, chosen over the
Zed and pgEdge forks because it is the one with a documented restricted access mode — which is
what makes `execute_sql` removable rather than merely discouraged.

Scores are stored per server in the catalogue and recomputed on every run rather than pasted
here, so the table below cannot go stale against them. Extras are `scopeSafety` (10) and
`headlessAuth` (5); `bundle`, `a11y` and `ts` are `n/a` throughout and rescale.

| Candidate | Version | License | Maint. | Bundle | A11y | TS | Agent | Extras | Total | Gates | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **playwright** | 0.0.82 | 4 | 4 | n/a | n/a | n/a | 4 | 3 / 4 | **98** | pass | **adopt** |
| **github** | remote | 3 | 4 | n/a | n/a | n/a | 4 | 4 / 4 | **92** | pass | **adopt** |
| **linear** | remote | 3 | 4 | n/a | n/a | n/a | 4 | 4 / 3 | **91** | pass | **adopt** |
| **stripe** | remote | 3 | 4 | n/a | n/a | n/a | 4 | 3 / 4 | **90** | pass | **adopt** |
| google-drive | connector | 3 | 4 | n/a | n/a | n/a | 3 | 3 / 1 | 80 | pass | adopt |
| miro | remote | 3 | 4 | n/a | n/a | n/a | 3 | 2 / 2 | 79 | pass | adopt |
| postgres | crystaldba | 3 | 3 | n/a | n/a | n/a | 3 | 3 / 4 | 76 | pass | adopt |
| notion | remote | 3 | 3 | n/a | n/a | n/a | 3 | 2 / 2 | 71 | pass | trial |
| gamma | remote | 3 | 3 | n/a | n/a | n/a | 2 | 3 / 1 | 67 | pass | trial |
| webflow | remote | 3 | 2 | n/a | n/a | n/a | 3 | 2 / 2 | 64 | pass | trial |
| forgejo | unknown | 1 | 2 | n/a | n/a | n/a | 2 | 2 / 4 | 45 | pass | reject |

A verdict is not a wiring decision. `google-drive`, `miro` and `postgres` score `adopt` and are
still unwired, because the rubric scores the server and `status` records whether we can reach it
(see the Needs Justin table in `docs/platform/mcp-catalog.md` section 6).

## Re-open criteria

- **Date.** `reviewDate` 2026-12-18 passes while the status is `Accepted`.
- **Fact.** A vendor renames or removes a catalogued tool; a first-party read-only endpoint
  appears for Notion, Stripe, Webflow or Miro; the Forgejo server's SPDX expression is read from
  a release artefact; PAP-106 starts generating the fragments this ADR only checks.
- **Budget.** A server's `budgetPerSession` is exceeded by real sessions twice in a week.
- **Advisory.** A critical advisory lands against a catalogued server with no patched version
  within 14 days — the `openAdvisory` gate, which still applies.

## References

- Linear issue: PAP-210
- Catalogue: `.claude/mcp/catalog.json`; guide: `.claude/mcp/README.md`; prose: `docs/platform/mcp-catalog.md`
- Validator: `packages/agents/src/mcp/`
- Rubric: `docs/platform/library-rubric.md` (ADR 0009); ADR 0002 for `prefer: forgejo`
- Threat model: sections 4 (deny list) and 5 (secrets, broker placeholders)
- Consumers: PAP-103 (character schema), PAP-106 and PAP-711 (runtime enforcement), PAP-121
  (connector cross-check), PAP-96 (budgets), PAP-217 (Renovate group)
- Vendor sources verified 2026-09-19: <https://linear.app/docs/mcp>,
  <https://github.com/github/github-mcp-server/blob/main/docs/remote-server.md>,
  <https://docs.stripe.com/mcp>, <https://developers.notion.com/guides/mcp/overview>,
  <https://developers.webflow.com/data/docs/ai-tools>, <https://developers.miro.com/docs/miro-mcp>,
  <https://developers.gamma.app/mcp/gamma-mcp-server>,
  <https://playwright.dev/docs/getting-started-mcp>,
  <https://github.com/crystaldba/postgres-mcp>,
  <https://github.com/modelcontextprotocol/servers-archived/tree/main/src/postgres>
