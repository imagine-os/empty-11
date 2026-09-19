# Review comment template

Rendered by `renderReview(findings, options)` in `packages/contracts/quality/src/render.ts` (snapshot-tested in `test/render.test.ts`). Every Gate 2 review, the vision report and the edge-case report use this shape so PAP-89's digest and PAP-241's calibration parse one format.

## Shape

```markdown
## Review: <reviewer> @ `<sha12>`

**Gate:** pass | fail (<reasons>)

| S0 | S1 | S2 | S3 | question | praise |
|---:|---:|---:|---:|---:|---:|
| n | n | n | n | n | n |

### S0 blocker (n)

<!-- finding:<id> -->
- **<title>** — [`<file>:<line>-<endLine>`](<fileLinkBase>/<file>#L<line>-L<endLine>) · `<rubricId>` · confidence 0.95 · autofixable
  <body: failure scenario and the proving test>
  Evidence: code `<ref>`, screenshot `<ref>`
  ```diff
  <suggestion>
  ```

### S1 major (n)
...
### S2 minor (n)
...
### S3 nit (n)
...
### Questions (n)
...
### Praise (n)
...

<details><summary>Rubric coverage</summary>

- checked (n): RUB-...
- n/a (n): RUB-...
- skipped (n): RUB-...

</details>

**Not checked:** <what the reviewer did not look at and why>
```

## Rules

- Header counts use the effective severity: a waived finding counts as a question and shows `(waived by <who> until <date>: <reason>)` on its line.
- Groups appear only when non-empty; inside a group findings sort by file, line, then id, so the same findings always render the same text.
- The `<!-- finding:<id> -->` marker is what the harness (PAP-243) matches on re-review to update rather than duplicate; inline PR comments carry the same marker.
- `file` omitted renders as `repo-wide`. `fileLinkBase` omitted renders plain backticked paths (Forgejo or local).
- A suggestion that starts with `---`, `@@` or `diff` renders as a ` ```diff ` block; anything else as ` ```suggestion ` so GitHub offers "Commit suggestion".
- The "Not checked" line is Sentinel's report rule: a review is a review-to-build handoff and says what it did not cover.
