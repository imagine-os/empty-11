# ops/ci/pages

Workflow: [`.github/workflows/pages.yml`](../../../.github/workflows/pages.yml) (PAP-15). Full
scheme and rationale: [`docs/platform/pages-deploy.md`](../../../docs/platform/pages-deploy.md).
This file is the operator checklist and the CI-side notes; the doc above is the reference.

## Repo settings checklist (Needs Justin)

GitHub Pages is not self-service from a workflow — someone with repo admin has to flip it on once:

1. Repo Settings → Pages → **Source: GitHub Actions** (not "Deploy from a branch"; org policy is
   the Actions source for every app, per `docs/decisions/` and the build brief).
2. Nothing else to configure: `pages.yml` provides its own `environment: github-pages`, and
   `actions/deploy-pages@v4` creates the Pages deployment the first time it runs after Source is
   set.
3. Confirm at `https://imagine-os.github.io/<repo>/` after the first push to `main` builds green.
4. If the repo is private: GitHub Pages needs GitHub Pro/Team/Enterprise for a private repo's
   Pages site to be public. Until that is in place, publish to a public `<repo>-demo` mirror
   instead (Definition of done edge case) — this is also a Needs Justin decision, not something a
   workflow can do on its own.

None of this blocks building or landing PAP-15's workflow: the workflow runs and its `check` steps
pass with Pages Source unset, it simply has nothing to deploy to until the setting above is made.

## The base-path rule

`BASE_PATH` is **always derived from `github.event.repository.name`** inside the workflow (see the
`Derive BASE_PATH and build info` step in `pages.yml`), never hard-coded to the current repo slug
(`empty-11`). Justin renames this repo later; that rename needs zero workflow edits because of this
rule. Locally, pass it explicitly:

```bash
BASE_PATH=/empty-11/ pnpm --filter web build
```

`apps/web/vite.config.ts` reads `BASE_PATH` (falling back to `/`) — see PAP-13's `vite.config.ts`
and ADR [0001](../../../docs/adr/0001-monorepo-stack.md).

## Why previews are artifact-only today

The workflow's `pull_request` and `workflow_dispatch` paths build a preview under
`previews/pr-<n>/` or `previews/<name>/` and upload it with `actions/upload-artifact` (a
downloadable zip), not `actions/deploy-pages`. That is a deliberate limit, not an oversight:

GitHub Pages with **Source: GitHub Actions** (org policy) deploys the *entire* artifact you upload
as the *entire* published site — one `deploy-pages` call replaces everything that was live before
it. There is no server-side merge, so deploying just a `previews/<name>/` folder would delete
whatever else was published (the production root, and any other live preview). The classic
per-PR-preview recipes (`peaceiris/actions-gh-pages` with `keep_files: true`) get around this by
using the **branch** source instead (`gh-pages`), where each deploy is a commit that can leave
sibling folders alone. Org policy for this repo is the Actions source, so that escape hatch is not
available here without a policy exception.

**Follow-ups** (tracked as their own issue, not built here):

* A merge step that, before calling `deploy-pages`, downloads the artifact from the *currently
  live* Pages deployment (via the Pages API or by keeping a persistent orphan branch as a content
  cache), overlays the new preview folder into it, and re-uploads the combined tree as one
  artifact. This is what would make `/<repo>/previews/<name>/` actually live at the same time as
  production.
* A weekly or on-`workflow_dispatch` prune of stale `previews/*` folders once the merge step above
  exists (nothing to prune today, since nothing under `previews/` is ever deployed live).
* Wiring the `pull_request` `closed` event to remove a PR's preview folder once it is deployed —
  meaningless until the merge step lands, so not built either.

Until then, a reviewer gets the preview build by downloading the workflow run's
`pages-preview-<base-path>` artifact and opening `index.html` locally (or via `pnpm dlx serve`),
which still validates the build and lets someone eyeball it without touching production.

## Local build + smoke check

```bash
BASE_PATH=/empty-11/ pnpm --filter web build
node ops/ci/pages/smoke.mjs apps/web/dist /empty-11/
```

`smoke.mjs` starts a static file server rooted at the built `dist/`, serves it under the given base
path, fetches `index.html` and every asset `index.html` references, and fails loudly if any of them
404s — the same failure mode a wrong `base` in `vite.config.ts` would cause on the real Pages URL.

## Validating the workflow

```bash
actionlint .github/workflows/pages.yml
```

CI does not run actionlint yet (PAP-78 owns extending `ci.yml`'s gates); until it does, run it by
hand before pushing a change to this workflow.
