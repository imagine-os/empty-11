# Evidence: PAP-103 character schema

| File | Proves |
| -- | -- |
| `validate-golden.txt` | `validate fixtures/valid`: 37 characters, 0 errors, the one expected `MCP_CATALOG_STUB` warning |
| `validate-invalid.txt` | every `fixtures/invalid/*.yaml` fails with its `# expect:` code (cycle names the cycle) |
| `plan-conversion.yaml` | dry-run conversion of plan.json `agents[]`: 37 skeletons, strict-parsed, no field outside the schema |
| `convert-plan-check.txt` | the skeletons agree with the golden fixtures on every field the plan carries |

The Definition of Done asks for a VS Code completion screenshot. This session runs headless without
an editor, so the wiring is delivered instead: every fixture carries a
`# yaml-language-server: $schema=...` modeline pointing at the committed JSON Schema, which the YAML
extension reads without workspace settings (`.vscode/settings.json` is gitignored here). The screenshot
is a follow-up for the first session with an editor (PAP-284 opens these files anyway).
