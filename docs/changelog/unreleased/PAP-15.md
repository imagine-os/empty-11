### Added — PAP-15: GitHub Pages demo deploy for apps/web

- `pages` workflow (`push` to `main`, `pull_request`, `workflow_dispatch`): builds `apps/web` with
  `BASE_PATH` derived from `github.event.repository.name` (never hard-coded), deploys production
  to `https://imagine-os.github.io/<repo>/` via `upload-pages-artifact` + `deploy-pages`. PR and
  manual-dispatch builds upload a downloadable preview artifact instead of a live
  `previews/<name>/` deploy — the Actions Pages source has no server-side merge, so a live
  sub-path preview needs its own follow-up (see `docs/platform/pages-deploy.md`).
- `apps/web/public/404.html`: SPA fallback for a future client-side router (PAP-16); the redirect
  decoder half belongs in the router's boot sequence.
- `apps/web/vite.config.ts`: `build.sourcemap` changed from `true` to `'hidden'` for the public
  Pages build (keeps `.map` files, drops the devtools auto-load comment); stricter option tracked
  as Triage PAP-1012.
- Paths: `.github/workflows/pages.yml`, `ops/ci/pages/`, `apps/web/public/404.html`,
  `apps/web/vite.config.ts`, `docs/platform/pages-deploy.md`.
- Needs Justin: repo Settings → Pages → Source: GitHub Actions (see `ops/ci/pages/README.md`).
