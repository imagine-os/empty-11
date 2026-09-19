# Unreleased changelog fragments

`CHANGELOG.md` is **never edited by hand**. Every issue that changes behaviour drops one fragment
here, named after its issue:

```
docs/changelog/unreleased/PAP-<n>.md
```

Two to six lines, in this shape:

```markdown
### Added — PAP-13: monorepo scaffold

- pnpm + Turborepo workspace with strict TypeScript and a Vite React 19 web app.
- Paths: `package.json`, `turbo.json`, `apps/web/`, `packages/*`.
- ADR: [0001-monorepo-stack](../../adr/0001-monorepo-stack.md)
```

Rules:

* One fragment per issue; one heading, `### Added|Changed|Fixed|Removed|Security — PAP-<n>: <title>`.
* Name the paths you touched and the ADR, if any. Link, do not retell.
* Fragments are append-only while unreleased. The release pass concatenates them into
  `CHANGELOG.md` under the new version and empties this folder — that is the only time
  `CHANGELOG.md` changes.
* No fragment, no merge: the release notes are assembled from this folder, so a missing fragment is
  a missing line in the notes.
