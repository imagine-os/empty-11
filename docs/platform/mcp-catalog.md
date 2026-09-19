# The MCP server catalogue

Status: v1, 2026-09-19. Owner: Atlas. Issue: PAP-210. Decision: [ADR 0021](../adr/0021-mcp-catalog.md).
Machine-readable source of truth: [`.claude/mcp/catalog.json`](../../.claude/mcp/catalog.json).
How to add one: [`.claude/mcp/README.md`](../../.claude/mcp/README.md).

Every MCP server an agent can reach is in one file, with every tool classified, every credential
declared as a placeholder and every allowlist checked by a test. This page is the prose; the JSON
is what the validator reads.

---

## 1. The eleven servers

R / W / D counts are classified tools: read, write, and named destructive tools. Score is the
[PAP-209 rubric](library-rubric.md) total, recomputed from the scores on every `pnpm check`.

| Server | Kind | Endpoint or package | Auth | Owner | R / W / D | Score | Status |
| -- | -- | -- | -- | -- | -- | -- | -- |
| `linear` | remote / http | `https://mcp.linear.app/mcp` | oauth (headless via key) | Atlas | 4R / 5W / 5D | 91 adopt | adopted |
| `github` | remote / http | `https://api.githubcopilot.com/mcp/` | bearer (headless) | Atlas | 5R / 3W / 7D | 92 adopt | adopted |
| `forgejo` | stdio | `code.forgejo.org/forgejo/forgejo-mcp` | bearer (headless) | Forge | 3R / 2W / 5D | 45 reject | candidate |
| `stripe` | remote / http | `https://mcp.stripe.com` | bearer (headless) | Ledger | 8R / 1W / 1D | 90 adopt | adopted |
| `notion` | remote / http | `https://mcp.notion.com/mcp` | oauth (human once) | Quill | 2R / 6W / 2D | 71 trial | needs-account |
| `google-drive` | connector | Claude connector, no `.mcp.json` entry | oauth (human once) | Quill | 6R / 1W / 0D | 80 adopt | needs-account |
| `webflow` | remote / sse | `https://mcp.webflow.com/sse` | oauth (human once) | Beacon | 5R / 3W / 3D | 64 trial | needs-account |
| `miro` | remote / http | `https://mcp.miro.com/` | oauth (human once) | Beacon | 3R / 4W / 2D | 79 adopt | needs-account |
| `gamma` | remote / http | `https://mcp.gamma.app/mcp` | oauth (human once) | Beacon | 2R / 1W / 1D | 67 trial | needs-account |
| `playwright` | stdio | `@playwright/mcp@0.0.82` | none | Sentinel | 4R / 4W / 1D | 98 adopt | adopted |
| `postgres` | stdio | `crystaldba/postgres-mcp` | api-key (DSN) | Forge | 7R / 0W / 1D | 76 adopt | candidate |

Four are wired today: `linear`, `github`, `playwright` and `stripe`. The rest wait on an account
(Needs Justin, section 6) or on infrastructure that does not exist yet.

**Facts verified 2026-09-19.** `@playwright/mcp` 0.0.82 published 2026-09-18, Apache-2.0
([npm](https://registry.npmjs.org/@playwright/mcp)). Stripe's tool table read verbatim from
[docs.stripe.com/mcp](https://docs.stripe.com/mcp). Linear's read-only endpoint and Streamable
HTTP transport from [linear.app/docs/mcp](https://linear.app/docs/mcp). GitHub's `/readonly` and
per-toolset URLs from
[github/github-mcp-server](https://github.com/github/github-mcp-server/blob/main/docs/remote-server.md).
Notion's remote endpoint from
[developers.notion.com](https://developers.notion.com/guides/mcp/overview); package
`@notionhq/notion-mcp-server` 2.5.1 published 2026-07-25. Webflow's endpoint from
[developers.webflow.com](https://developers.webflow.com/data/docs/ai-tools). Miro's from
[developers.miro.com](https://developers.miro.com/docs/miro-mcp). Gamma's from
[developers.gamma.app](https://developers.gamma.app/mcp/gamma-mcp-server).

## 2. Scope classes, and why a tool has one

Three classes, and a tool without one fails the schema.

* **`read`** — cannot change anything. Granted to every character on the servers they hold.
* **`write`** — changes something reversible. Granted to the owning character and to Atlas.
* **`destructive`** — irreversible, public, or named on [Threat Model](../security/README.md)
  section 4. Granted to Atlas alone, and in practice Atlas files a PAP-94 approval card rather
  than calling it.

Two rules stop the classes drifting. A tool whose name carries a mutating verb (`delete`,
`publish`, `merge`, `truncate`, `revoke`, …) can never be `read`. And a tool named on a server's
`destructiveTools` list but classed `write` is an error, because every writing character would
be handed it — that rule is computed from the scope classes alone, independently of the name
list, so the two sources have to agree.

Three entries are worth reading for the judgement in them:

* **`stripe_api_write`** is a single generic passthrough for POST, PATCH, PUT and DELETE across
  the whole Stripe API. It is one call away from a refund, a payout or a transfer, all three of
  which Threat Model section 4 denies outright. So the most useful tool on the Stripe server is
  classed destructive and Ledger, who owns Stripe, does not have it. Stripe's own
  human-confirmation step on refunds is a second backstop, not the first.
* **`execute_sql`** on Postgres is the whole SQL surface in restricted mode or out of it.
  Removed from Forge, who owns it. A mode is configuration, and configuration drifts.
* **`merge_pull_request`** on GitHub lands commits on `main`, which the Git row of the deny list
  forbids. The ref protection in [`ops/forge/rulesets/`](../../ops/forge/rulesets/) is the
  server-side backstop; the catalogue is the first one.

## 3. Credentials: placeholders, never values

Every `auth` block names broker placeholders in the form `broker:<service>/<credential>` and
nothing else. The egress proxy injects the real credential per host and logs the use; the value
never enters a session, so a leaked transcript leaks a placeholder (Threat Model section 5).
`broker:stripe/restricted-key-test` exists and a live-mode counterpart deliberately does not:
Threat Model section 4 denies any `sk_live_` use, so there is nothing for the broker to hand
over.

Every string in the catalogue and in every fragment is scanned for credential-shaped text on
each `pnpm check` — Stripe, GitHub, Linear, Notion, Slack and Google key shapes, private key
blocks, DSNs with an inline password, and literal bearer tokens. The patterns require a body
after the prefix, so the deny list can name `sk_live_` in prose without tripping its own alarm.

## 4. Who gets what

`.claude/agents/<character>/mcp.json` is a real Claude Code `.mcp.json` body: the servers that
character gets, at the endpoint their scope allows. A character outside a server's
`writeCharacters` is pointed at the vendor's read-only endpoint where one exists — Linear's
`https://mcp.linear.app/mcp/readonly` and GitHub's `/readonly` — so least privilege is enforced
by the URL, not only by the tool filter.

| Character | Servers wired | Notes |
| -- | -- | -- |
| Atlas | linear (rw), github (rw), playwright | The only holder of destructive tools, and holds none by default. |
| Forge | linear (ro), github (rw) | Owns Forgejo and Postgres; both are candidates, so neither is wired. |
| Iris | linear (ro), github (ro), playwright | |
| Quill | linear (ro), github (ro) | Owns Notion and Drive; both wait on an account. |
| Sentinel | linear (ro), github (ro), playwright | Owns Playwright. A reviewer that can change what it reviews is not a reviewer, so no writes elsewhere. |
| Nova | linear (ro), github (ro), playwright | |
| Ledger | linear (ro), github (ro), stripe | Owns Stripe, without `stripe_api_write`. |
| Beacon | linear (ro), github (ro) | Owns Webflow, Miro and Gamma; all three wait on an account. |
| Scout | linear (ro), github (ro) | Reads widely, writes nowhere. |

A fragment may only wire a server the catalogue marks `adopted`. Wiring a candidate would boot a
session that cannot authenticate, and a session that fails at boot looks exactly like one that
was never meant to run.

Tool names follow Claude Code's grammar, `mcp__<server>__<tool>` — `mcp__linear__list_issues`.
That is the string PAP-106's allowlists and PAP-711's hook match on.

## 5. Servers we will not use

Recorded rather than deleted, so nobody re-litigates them.

* **`@modelcontextprotocol/server-postgres`** — deprecated and archived in July 2025 after a SQL
  injection finding: it wraps queries in a read-only transaction but accepts semicolon-separated
  statements, so `COMMIT; DROP SCHEMA public CASCADE;` ends the transaction and runs the rest
  with the connection's full privileges. Latest publish 0.6.2 (2024-12-04), no patched release.
  [Archive](https://github.com/modelcontextprotocol/servers-archived/tree/main/src/postgres).
  Superseded by Crystal DBA's `postgres-mcp`, chosen over the Zed and pgEdge forks because it is
  the one with a documented restricted access mode — which is what makes the destructive tool
  removable rather than merely discouraged.
* **`webflow-mcp-server` on npm** — the npm record for the name Webflow's own docs point at
  carries no `license` and no `repository` field, and its latest publish is 1.0.0 (2025-09-17).
  Until the publisher is confirmed, only the hosted endpoint is catalogued.
  [Registry record](https://registry.npmjs.org/webflow-mcp-server).

## 6. Needs Justin

None of these block anything: the placeholders and the catalogue entries exist, and a session
that reaches for a missing credential says so.

| Ask | For | Unblocks |
| -- | -- | -- |
| Linear API key for the agent identity, or one OAuth grant | `broker:linear/api-key` | Already wired; sessions read Linear through the read-only endpoint until it lands. |
| GitHub App installed on `imagine-os`, per-session installation tokens | `broker:github/app-installation-token` | PAP-48; already wired. |
| Stripe restricted **test-mode** key (read scopes plus the write scopes Ledger needs) | `broker:stripe/restricted-key-test` | Ledger's bundle. Live-mode keys are not requested and never will be from here. |
| Notion workspace with a `Sandbox` page tree, one OAuth grant per agent identity | `broker:notion/oauth` | `notion` moves from `needs-account` to `adopted`. |
| Google account for the agent identity, a shared Drive folder, the Drive connector enabled on a paid Claude plan | `broker:google-drive/oauth` | `google-drive`. Note it is a connector, not a `.mcp.json` server: it cannot be probed in CI and every check reports `skipped: interactive-only`. |
| Webflow account with a staging site, one OAuth grant | `broker:webflow/oauth` | `webflow`. |
| Miro account with a dedicated team, one OAuth grant | `broker:miro/oauth` | `miro`. |
| Gamma account plus an approved MCP access request | `broker:gamma/oauth` | `gamma`. Lowest value, most human steps, so it is last in the wiring order. |
| Hetzner account so the Forgejo instance can exist (PAP-47) | `broker:forgejo/bot-token` | `forgejo`, and with it ADR 0002's `prefer: forgejo`. |
| Staging Postgres (PAP-30, PAP-34) | `broker:postgres/staging-dsn` | `postgres`. |

## 7. What this does not do yet

The checker is static: it reads the catalogue and the fragments, never the network. Probing a
live server, diffing its `tools/list` against the catalogue, aging out renamed tools through an
`aliases` window and reporting missing broker placeholders is `pnpm mcp check`, and it is a
follow-up. Enforcing the allowlists at runtime is PAP-106 and PAP-711; cross-checking the
connector files is PAP-121; per-session budgets are PAP-96; pinning the server versions in a
Renovate group is PAP-217.
