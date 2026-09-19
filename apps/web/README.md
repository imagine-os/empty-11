# @paperos/web

The PaperOS web shell. Today it renders one placeholder route; PAP-16 adds the router,
PAP-18 the PWA layer, PAP-15 the GitHub Pages deploy.

```bash
pnpm dev            # http://localhost:5173
pnpm --filter @paperos/web build
```

Build-time env: `BASE_PATH` (Vite `base`, GitHub Pages sub-path) and `VITE_GIT_SHA`
(stamped into the bundle; falls back to `git rev-parse --short HEAD`).
