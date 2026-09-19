# `.claude/mcp` — the MCP server catalogue

`catalog.json` is the one place that says which MCP servers exist, what each of their tools can
do, who may call them and with what credential. Everything else about MCP in this repo is
derived from it or checked against it.

Issue: PAP-210. Decision: [ADR 0021](../../docs/adr/0021-mcp-catalog.md). Prose and the full
table: [`docs/platform/mcp-catalog.md`](../../docs/platform/mcp-catalog.md).

## The three rules

**Every tool carries a scope class.** `read`, `write` or `destructive`, and a missing one is a
schema error rather than a default. A default would read as "harmless", and the tools that
hurt are exactly the ones nobody got round to classifying.

**Destructive tools reach Atlas and nobody else.** This is the second of the three enforcement
points the [Security & Threat Model](../../docs/security/README.md) section 4 names for the
deny list, alongside the `PreToolUse` hook (PAP-711) and a server-side backstop. Here it is
`packages/agents/src/mcp/validate.ts`, rule `destructive-atlas-only`, and it is checked twice
from two independent sources so a tool cannot slip through by being misclassified.

**No credential ever appears here.** Auth is declared as broker placeholders,
`broker:<service>/<credential>`; the egress proxy swaps them per host and the value never
enters a session (Threat Model section 5). Every string in this folder is scanned for
credential-shaped text on every `pnpm check`.

## Files

| Path | What |
| -- | -- |
| `catalog.json` | The catalogue. Hand-written, one entry per server, plus a `denied` list of servers we will not use and why. |
| `../agents/<character>/mcp.json` | The nine lead bundles: the servers that character actually gets, at the endpoint their scope allows. Checked against the catalogue. |
| `../../packages/agents/src/mcp/` | Zod schema, rubric arithmetic, validator, tests. |

A fragment is a real Claude Code `.mcp.json` body: copy it to the session's `.mcp.json` and the
session boots with exactly that surface. PAP-106 turns these stubs into generated bundles with
the `settings.json` and `hooks.json` beside them.

## Adding a server

1. **Score it** against [the rubric](../../docs/platform/library-rubric.md) (PAP-209). MCP
   servers use the six criteria plus two domain extras, `scopeSafety` and `headlessAuth`, which
   are defined in `catalog.json` under `rubric.domainExtras` and apply to every server in the
   catalogue. `bundle`, `a11y` and `ts` are usually `n/a` — nothing reaches a browser, there is
   no UI, and we execute the server rather than importing it. A score of 3 or 4 needs a URL in
   its `evidence`; the validator enforces that, not a reviewer.
2. **Classify every tool.** Read the vendor's tool table and mark each entry `source: "docs"`.
   If you are inferring a name, mark it `source: "inferred"` — an inferred name on an adopted
   server is a warning until a live `tools/list` reconciles it.
3. **Name the destructive ones.** Anything irreversible, anything public, anything on Threat
   Model section 4. Be generous: a tool wrongly called destructive costs one approval card, and
   a tool wrongly called write costs a production incident.
4. **Set `status`.** `adopted` means decided and wired into at least one bundle.
   `needs-account` means the decision is made but Justin has to provide the account.
   `candidate` means not yet. `denied` servers go in the `denied` array with their evidence,
   never deleted — the next session must not have to re-litigate them.
5. **Leave `rubric.total` alone if you like**: run `pnpm --filter @paperos/agents mcp:check` and
   the test tells you the number it should be.
6. **Add its row** to `docs/platform/mcp-catalog.md` and to
   `docs/reference/surfaces.md`, and write the changelog fragment.

## Checking it

```
pnpm --filter @paperos/agents mcp:check   # schema, allowlists, secrets, rubric, fragments
pnpm check                                # the gate; includes the above
```

The checker is static: it reads the catalogue and the fragments, not the network. Probing a
live server (`tools/list`, drift against the catalogue, missing broker placeholders) is
`pnpm mcp check` and is a follow-up — see ADR 0021, Consequences.
