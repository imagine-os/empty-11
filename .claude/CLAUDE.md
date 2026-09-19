# .claude/

Pointer file. The instructions for this repo live in the **root `CLAUDE.md`** — read that first.

| Folder | Holds | Owner |
| -- | -- | -- |
| `agents/` | character definitions (one file per PaperOS agent: Atlas, Forge, Iris, Quill, Sentinel, Nova, Ledger, Beacon, Scout) | agents (PAP-103) |
| `skills/` | task skills a session can load (gate runs, spec generation, release) | agents (PAP-108) |
| `rules/` | repo rules a session must obey, split so they can be cited individually | agents / quality |

Files here are prompts, not code: they are not compiled, linted or tested by `pnpm check`.
