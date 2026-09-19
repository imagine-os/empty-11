# Evidence: PAP-284 live roster

Captured 2026-09-19 from `packages/agents` in the worktree, after `pnpm check` was green.

| File | Command | Result |
| -- | -- | -- |
| `tree.txt` | `node scripts/tree.ts --check` | org tree, `tree matches plan.json: 9 leads, 28 subs`, exit 0 |
| `validate.txt` | `node scripts/validate.ts` | live roster and `fixtures/valid`: 37 characters each, 0 errors, 1 warning (`MCP_CATALOG_STUB`, clears with PAP-210) |
| `plan-to-roster-check.txt` | `node scripts/plan-to-roster.ts --check` | 37 characters, 0 would change, 0 orphans, exit 0 |

The Vitest suite (`src/roster/*.test.ts`, 84 tests in the package) asserts the same plus the shares
sum, label uniqueness, the inheritance groups and the converter snapshot
(`fixtures/plan-to-roster.snapshot.yaml`).
