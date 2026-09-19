# GitHub Pages demo deploy (PAP-15)

Every PaperOS app repo publishes a static build of `apps/web` to GitHub Pages so a reviewer, the
vision agent (PAP-83) and Justin can open a URL instead of running code. Workflow:
[`.github/workflows/pages.yml`](../../.github/workflows/pages.yml). Operator checklist and CI-side
notes: [`ops/ci/pages/README.md`](../../ops/ci/pages/README.md).

## URL scheme

| What | URL | Live today? |
| -- | -- | -- |
| Production (`main`) | `https://imagine-os.github.io/<repo>/` | Yes, once Pages Source is set (Needs Justin, below) |
| Preview build | `https://imagine-os.github.io/<repo>/previews/<name>/` | Documented, not deployed live yet — see "Sub-path preview strategy" |
| Custom domain | TBD | Later, per PAP-431 |

`<repo>` is never hard-coded: the workflow derives it from `github.event.repository.name` at build
time, so Justin renaming this repo (`empty-11` today) needs no workflow change. `<name>` is
`pr-<n>` for a pull request or the `preview_name` input (falling back to the branch name) for a
manual `workflow_dispatch` run.

## Pages source: GitHub Actions (org policy)

**Needs Justin:** repo Settings → Pages → **Source: GitHub Actions**. This is a one-time,
per-repo, admin-only setting; no workflow can set it. Until it is set, `pages.yml` still runs and
its build/check steps still pass — the `deploy` job has nothing to publish to, that's all. Full
checklist: [`ops/ci/pages/README.md`](../../ops/ci/pages/README.md) "Repo settings checklist".

## How a production deploy works

1. A push lands on `main` that touches `apps/web/**`, `packages/ui/**`, `packages/core/**` or the
   workflow itself.
2. `build` installs, derives `BASE_PATH=/<repo>/` from the event, runs
   `pnpm --filter web build` with `VITE_GIT_SHA`, `VITE_BUILD_TIME` and `VITE_PR_NUMBER` (empty on
   `main`) set, and uploads `apps/web/dist` with `actions/upload-pages-artifact`.
3. `deploy` (needs `pages: write`, `id-token: write`, `environment: github-pages`) calls
   `actions/deploy-pages`, which publishes that artifact as the entire live site.

A deep link into the SPA (once PAP-16's router lands) falls through to
[`apps/web/public/404.html`](../../apps/web/public/404.html), which GitHub Pages serves for any
path with no matching file. It re-encodes the real path into a query string and redirects to the
site root — the [rafgraph spa-github-pages](https://github.com/rafgraph/spa-github-pages)
technique. The decoder half (reading that query string back with `history.replaceState` before the
app renders) belongs in the router's boot sequence and is PAP-16's to add; wiring it here would
race that in-flight work on the same file.

## Sub-path preview strategy (documented for later, not built)

The spec's original design (per-PR previews always live, sticky PR comment, removed on close)
assumes a Pages deploy that can publish just a sub-folder without touching the rest of the site —
true for the **branch** Pages source (`peaceiris/actions-gh-pages` with `keep_files: true`
against a `gh-pages` branch, `force_orphan: false`) but not for the **Actions** source org policy
picked here: `actions/deploy-pages` publishes the *whole* artifact you hand it as the *whole* site,
replacing what was live before. There is no server-side merge, so an isolated preview deploy would
delete production (and every other live preview).

Today's `pull_request` and `workflow_dispatch` triggers therefore build the preview and upload it
as a plain workflow artifact (`actions/upload-artifact`, downloadable, 14-day retention) instead of
deploying it live — see `pages.yml`'s header comment and `ops/ci/pages/README.md` "Why previews are
artifact-only today" for the full reasoning and the concrete follow-up (a merge step that fetches
the currently-live tree, overlays the new preview folder, and re-uploads the combined artifact
before calling `deploy-pages`). That follow-up is what would make
`https://imagine-os.github.io/<repo>/previews/<name>/` resolve live; file it as its own issue
before building it rather than growing it inside this one.

Also out of this issue, tracked separately per the spec's Scope: the sticky PR comment
(`marocchino/sticky-pull-request-comment@v2`), the `<BuildInfo/>` footer badge, and `pnpm
demo:url` — all of which depend on the merge step above to point at a URL that is actually live,
and on there being an open PR to comment on (there are none in the build loop today; see
`BRIEF.md`).

## Build-time env vars

| Var | Set by | Meaning |
| -- | -- | -- |
| `BASE_PATH` | `pages.yml`, derived from `github.event.repository.name` (never hard-coded) | Vite `base`; consumed in `apps/web/vite.config.ts` (PAP-13) |
| `VITE_GIT_SHA` | `pages.yml` (PR head SHA or `github.sha`) | Commit stamped into the bundle; `apps/web/vite.config.ts` already `define`s this |
| `VITE_BUILD_TIME` | `pages.yml` (UTC ISO-8601 at build time) | For a future `<BuildInfo/>` badge; Vite auto-exposes any `VITE_`-prefixed process env var, no `vite.config.ts` change needed |
| `VITE_PR_NUMBER` | `pages.yml` (empty outside a PR build) | Same as above |

`packages/core/src/config/public.ts` does not exist yet; PAP-17 is the issue that types these in a
shared schema (Interface contract, "Consumes"). Until then they are plain
`import.meta.env.VITE_*` reads, same mechanism `App.tsx` already uses for `VITE_GIT_SHA`.

## Local build + smoke check

```bash
BASE_PATH=/empty-11/ pnpm --filter web build
node ops/ci/pages/smoke.mjs apps/web/dist /empty-11/
```

The smoke script serves `apps/web/dist` under the given base path and confirms `index.html` and
every asset it references resolve there — the same failure a wrong `base` would cause on the real
Pages URL. See [`ops/ci/pages/README.md`](../../ops/ci/pages/README.md).

## Sourcemaps on the public build

`apps/web/vite.config.ts`'s `build.sourcemap` is `'hidden'`, not `true`: this build is published
publicly, so we still emit `.map` files (kept for our own error-correlation tooling) but omit the
`//# sourceMappingURL` comment that would make a public visitor's devtools auto-fetch and display
original source. Flagged by review; a stricter option (drop maps from the public artifact
entirely, or gate this behind an env check) is tracked as Triage **PAP-1012**.

## Edge cases (spec)

* **Repo renamed** — handled by deriving `BASE_PATH` from `github.event.repository.name`; no
  further action needed on rename.
* **Fork PRs** lack a write token for a live deploy anyway — moot today since previews are
  artifact-only for every PR, fork or not (see "Sub-path preview strategy" above).
* **Two deploys racing** — `deploy-pages` deployments are queued and serialized by GitHub itself;
  `pages.yml`'s `concurrency` group additionally cancels a stale in-progress *build* for the same
  ref/PR before it reaches deploy.
* **Site or asset too large** — no `size-limit` check exists yet; `actions/upload-pages-artifact`
  and GitHub Pages both enforce their own hard caps (Pages: 1 GB site) and fail the workflow
  loudly if hit. A dedicated `size-limit` check is a follow-up, not built here.
* **Private repo** — GitHub Pages needs GitHub Pro/Team/Enterprise to publish a private repo
  publicly; until Justin confirms that plan, publish to a public `<repo>-demo` mirror instead
  (Needs Justin, `ops/ci/pages/README.md`).
