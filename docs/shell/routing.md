# Router and shell (PAP-16)

Every PaperOS app gets one file-based, fully-typed router (TanStack Router 1.x)
whose pages render inside `<AppShell>`, a CSS-grid layout with six named
slots — `nav`, `sidebar`, `main`, `inspector`, `commandbar`, `statusbar`. A
page's `specs/pages/<id>.spec.yaml` (PAP-114) declares which components go in
which slot; the shell renders whatever is registered. Agents add a page by
adding a spec and a route file — the shell does the rest.

Runtime: `@paperos/core/shell` (`AppShell`, `Slot`, `registerSlot`,
`useLayout`, `useSpecLayout`, `useSpec`, `useShellSearch`, the slot registry,
the breakpoint hook). Import its stylesheet once, from `main.tsx`:
`import '@paperos/core/shell/shell.css'`.

## Adding a route plus spec, in under 10 steps

1. **Write the spec.** `specs/pages/<id>.spec.yaml` — `meta` (id, title as a
   message key, route, surface, owner), `purpose.summary`, `layout.template`
   (`app` for authenticated pages, `public` for marketing/auth), and
   `layout.slots` naming every slot a component below targets.
2. **List its components.** Under `components:`, one entry per slot fill:
   `id` (a registered `ui.*`/`app.*`/`print.*` component id), `key`
   (camelCase, page-unique), `slot` (defaults to `main`). Mark a placeholder
   `status: not-wired` — the shell wraps it in the "not wired yet" treatment
   automatically; nothing else to do.
3. **Declare its actions**, if any, under `logic.actions`: `intent` (a
   message key), `permission`, `steps`. This *is* the actions registry
   (org standard) — `useSpecLayout` publishes it to `window.__paperos.actions`
   in dev mode with no extra code.
4. **Register the component(s)** the spec names, once, in
   `apps/web/src/components/registry.ts`: `registerComponent('app.myThing', MyThing)`.
5. **Register the spec** in `apps/web/src/specs/registry.ts`:
   `registerSpec(mySpec.meta.id, mySpec)`.
6. **Add the message keys** the spec and component reference to
   `apps/web/src/i18n/en.json` and `es.json`.
7. **Create the route file** under `apps/web/src/routes/`, mirroring the
   spec's route: `_app/<name>.tsx` for an authenticated page (nested under
   the pathless `_app` layout), `_public/<name>.tsx` for a public one. A
   folder + `index.tsx` gives a trailing-slash-free path (`_app/settings/index.tsx`
   → `/settings`).
8. **Write the route component**: `createFileRoute('/_app/<name>')({ component, staticData: { spec: mySpec.meta.id, title: mySpec.meta.title, audience: mySpec.meta.surface } })`, and inside the component, one line — `useSpecLayout(mySpec)` — to fill every slot and register every action.
9. **Run `pnpm dev`** (or `vite build`) once so the TanStack Router Vite
   plugin regenerates `src/routeTree.gen.ts`, and commit that file (it is
   generated but checked in, like every generated file in this repo — see
   `CLAUDE.md` "Never edit generated files"; typecheck reads it directly and
   does not run the app's own build first).
10. **Add a nav link** (`<Link to="/my-route">`) wherever it belongs — a
    typed `Link` to a route that does not exist fails `pnpm typecheck`
    (`apps/web/src/type-tests/link-to-missing-route.tsx` is the fixture that
    proves it).

## Layout and breakpoints

Grid areas: `nav | sidebar | main | inspector`, `statusbar` full-width at the
bottom, `commandbar` a floating overlay (reserved for PAP-151; today it is a
"not wired yet" trigger button). Breakpoints mirror
`packages/core/src/devices/matrix.ts` (PAP-14): `xs 360, sm 390, md 768,
lg 1280, xl 1920, 2xl 2560, 3xl 3840`.

| Below | sidebar | inspector |
| --- | --- | --- |
| `md` (< 768) | drawer | drawer |
| `lg` (< 1280) | persistent | drawer |
| `lg` and up | persistent | persistent |

A drawer overlays the page (`position: fixed`, a scrim, full-width below
`md` so two simultaneous drawers cleanly stack instead of interleaving);
persistent means a real grid column. `<AppShell data-layout>` reflects the
overall shape (`drawer` | `inspector-drawer` | `grid`); `data-sidebar-mode`
and `data-inspector-mode` give the per-panel mode — what Playwright and
Testing Library assert against.

Panel *visibility* (shown at all, independent of drawer/persistent) is a URL
search param, `ShellSearch` (`@paperos/core/shell`): `?inspector=open` or
`?sidebar=collapsed`. Invalid or missing values fall back to the documented
default (`inspector=closed`, `sidebar=expanded`) rather than throwing.
`useShellSearch()` reads/writes it with `toggleInspector()`/`toggleSidebar()`
helpers.

## Interim state (deliberate; each item names what supersedes it)

* **`@paperos/core/shell` is the one place in `packages/core` with React.**
  It ships from its own `package.json` subpath (`"./shell"`), not the root
  barrel, so plain `@paperos/core` never pulls in React. PAP-447 lifts this
  into `@paperos/contract-app-shell`.
* **The component registry (`registerComponent`/`resolveComponent`) is a
  stand-in for PAP-69's real `ui.<component>` registry.** A spec-named
  component missing from it renders a visible `<code>` placeholder in dev,
  logs and renders nothing in production.
* **The spec adapter is structurally typed against `@paperos/spec`'s real
  `PageSpec`/`Component`/`Action` (PAP-114)**, not imported from it:
  `@paperos/spec` already depends on `@paperos/core` (for shared value
  types), so importing it back from `@paperos/core/shell` would be a real
  dependency cycle. `SpecLike`/`SpecComponentLike`/`SpecActionLike` in
  `spec-adapter.tsx` are the port; the real types satisfy them structurally.
  `apps/web`, which depends on both packages, is where the concrete type and
  the port meet.
* **Only root-level `components[]` entries are placed in a slot.** A
  component's own `children` render as part of it — a generic
  component-tree renderer (walking `children` recursively, resolving each
  node's own component) is PAP-69/74's job, not this issue's.
* **`vite-plugin-paperos-specs` is a bare YAML→JSON transform**, not
  `@paperos/spec`'s real `parseSpec`: `vite.config.ts`'s own module graph
  loads through plain Node ESM resolution, which cannot follow this
  monorepo's `.js`-suffixed imports back to their `.ts` sources the way a
  bundler or `tsx` does, so importing `@paperos/spec`'s runtime code directly
  into the Vite config fails to load. Real schema validation of every
  `specs/pages/*.yaml` file instead runs as a Vitest suite —
  `apps/web/src/specs/validate.test.ts` — which `pnpm check` gates on.
* **`composeRoutes(modules)`** (`route-contribution.ts`) is a stub PAP-28
  fills in once module manifests (PAP-264) can contribute routes.
* **Interim media queries, not container queries** — PAP-21 replaces the
  breakpoint-driven drawer/persistent switch with `@container` queries.
* **Sidebar/inspector are shown or hidden per `ShellSearch`, independent of
  whether anything is registered for them** — an authenticated page with no
  sidebar content still reserves the (empty) column at `md`+. Making an
  empty slot collapse itself is a small follow-up, not done here.

## Example routes

Three routes exercise this end to end: `/` (public home, `specs/pages/home.spec.yaml`,
nav only), `/dashboard` (`specs/pages/dashboard.spec.yaml`, nav + sidebar +
inspector, one `not-wired` action), `/settings` (`specs/pages/settings.spec.yaml`,
nested under `_app`, nav + sidebar — proves nested layouts never double-render
nav, since `<AppShell>` renders exactly once, at `__root.tsx`). A fourth,
`/error-demo`, exists only to exercise the root error boundary's retry button
(its loader always throws) — it is not linked from navigation and is not one
of the three examples above.
