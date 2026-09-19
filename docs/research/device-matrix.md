# Device matrix: research and decision (PAP-14)

**Status:** Decided. **Review date:** 2027-01. **Owner:** app-shell (Scout, with Forge on feasibility). **Machine-readable form:** `packages/core/src/devices/matrix.ts` → generated `ops/ci/breakpoints.json` (schema version in the file). **Decision record:** `docs/adr/0022-device-matrix.md`.

## 1. Decision

PaperOS commits to **seven width tiers** — `xs 360`, `sm 390`, `md 768`, `lg 1280`, `xl 1920`, `2xl 2560`, `3xl 3840` — and **six device classes** mapped onto them: phone, tablet, laptop, desktop, TV/kiosk, foldable. `BreakpointName` (`'xs'|'sm'|'md'|'lg'|'xl'|'2xl'|'3xl'`) is exhaustive; nothing outside this set is a supported design target. These seven widths are the vocabulary the rest of the plan uses (PAP-21's container queries, PAP-82's visual-regression matrix, PAP-84's video replays, PAP-70/154/158's layouts).

This overturns the issue's own starting point (`320/375/768/1024/1280/1536/1920` plus an optional `tv 3840`) in favor of `360/390/768/1280/1920/2560/3840`, which the current market data below supports better and which the platform's org-wide quality bar already assumes. The two sets agree at `md 768`; the difference matters mainly at the low end (`360`/`390` beat `320`/`375` as the dominant real phone viewports today) and the high end (`2560` earns its own tier instead of being folded into "≥1920", because 1440p monitors are now over a fifth of the install base and behave differently from 1080p at typical UI density).

## 2. Method and sources

Live traffic and hardware-panel data, not device spec sheets alone, because viewport *width* is what CSS reads, not screen diagonal:

- **StatCounter Global Stats**, screen-resolution stats, accessed 2026-09-19 — <https://gs.statcounter.com/screen-resolution-stats>, <https://gs.statcounter.com/screen-resolution-stats/desktop>, <https://gs.statcounter.com/screen-resolution-stats/mobile/worldwide>. Desktop: `1920×1080` still holds over half of desktop traffic; `3840×2160` (4K) has just passed the 5% mark. Mobile: `360×800`, `390×844` and `393×852` together are ~60% of mobile viewport traffic, with `360×800` (Android, chiefly Samsung Galaxy A/S series) the single most common mobile viewport and `390×844` (iPhone 12–16 family) a strong second.
- **Steam Hardware & Software Survey**, August 2026 — <https://store.steampowered.com/hwsurvey/resolution>. Primary display resolution: `1920×1080` 50.52%, `2560×1440` 21.86% (rising, driven by falling 1440p monitor prices), `3840×2160` 4.98% (rising). This is a gaming-PC-biased panel but is the best available longitudinal desktop-resolution series and corroborates StatCounter's desktop numbers independently.
- **Apple technical specifications and viewport references** for the current iPhone line — <https://www.apple.com/iphone-17/specs/>, <https://useyourloaf.com/blog/iphone-17-screen-sizes/>, <https://yesviz.com/devices/iphone-17/>. iPhone 17/17 Pro: CSS viewport `402×874` at DPR 3; iPhone 17 Pro Max: `440×956` at DPR 3; the iPhone 12–16 generation (still the bulk of the installed base per StatCounter) sits at `390×844`. Safe-area insets: portrait top ≈ 47–62pt / bottom 34pt depending on model, landscape moves the inset to the sides.
- **iPad viewport references** — <https://yesviz.com/devices/ipadpro/>, iPad viewport tables at screensizechecker.com and dev-toolbox.tech (accessed 2026-09-19). iPad Pro 12.9"/13": portrait CSS width ~1024–1032px at DPR 2; base iPad and iPad Air portrait ~744–834px. All of these land inside `md` (768–1279), confirming a single tablet tier is workable across the current iPad lineup.
- **Samsung Galaxy Z Fold7 viewport reference** — <https://yesviz.com/devices/samsung-z-fold7/>. Unfolded CSS viewport `984×1092` at DPR 2. This is the load-bearing data point for the ticket's foldable rule: 984 falls inside `md` (768–1279) under either this decision's breakpoints or the issue's original starting point, so "unfolded ⇒ `md`" holds regardless of which of the two candidate breakpoint sets wins.
- **W3C Device Posture API**, Candidate Recommendation Draft updated 2026-05-20 — <https://www.w3.org/TR/device-posture/>, <https://w3c.github.io/device-posture/>, and the Chrome origin-trial writeup — <https://developer.chrome.com/blog/foldable-apis-ot> (Chromium origin trial from Chrome 125). Defines the `device-posture` CSS media feature (`continuous` | `folded`) and a matching `DevicePosture` JS API.
- **Caniuse** — <https://caniuse.com/css-container-queries>, <https://caniuse.com/?search=unit> (dynamic viewport units `dvh`/`dvw`/`svh`/`lvh`) — both are baseline-supported in evergreen Chrome/Edge/Firefox/Safari as of 2026; the risk is old embedded/kiosk Chromium, not modern desktop or mobile browsers.
- **Smart TV browsing** — general 2026 smart-TV buying-guide coverage (electronicsdigest.org, digitalnpq.org, gagadget.com; accessed 2026-09-19) confirms 4K (`3840×2160`) as the standard panel resolution for TVs from ~43" up, and that webOS/Tizen/Google TV/Android TV all ship a Chromium-based browser — the same rendering engine family as desktop, but driven by remote/D-pad, not a mouse.

Every numeric claim above is attributed to a dated source; anything below without a citation is a PaperOS-side design decision, not a market fact.

## 3. The seven breakpoints

| Name | Min width | Represents | Why this number (data) |
|---|---:|---|---|
| `xs` | 360 | Small/mid Android phones | Single most common mobile viewport (StatCounter, 2026-09-19); dominant Galaxy A/S series width. |
| `sm` | 390 | iPhone-class phones | Second-most-common mobile viewport; iPhone 12–16 generation, the bulk of the current iPhone install base (Apple/useyourloaf/YesViz, 2026). |
| `md` | 768 | Tablets, unfolded foldables | Below every current iPad's portrait width (1024–1032) with headroom for Android tablets (~800–912) and the Z Fold7 unfolded (984) — one tier safely covers all of them without colliding with `lg`. |
| `lg` | 1280 | Laptops, small/landscape tablets | Common small-laptop native and effective width (1280×800, 1366×768 scaled); large enough to exclude portrait tablets, small enough to include budget Windows laptops and Chromebooks. |
| `xl` | 1920 | Mainstream desktop | Still >50% of gaming desktops (Steam, Aug 2026) and the plurality of all desktop traffic (StatCounter). The baseline "desktop" design target. |
| `2xl` | 2560 | 1440p / QHD desktop | 21.86% and rising (Steam, Aug 2026) — big enough a slice, with different UI density needs than 1080p, to deserve its own tier rather than being lumped into "everything ≥1920". |
| `3xl` | 3840 | 4K desktop workstation *and* TV/kiosk | 4K desktop is at roughly 5% (Steam, Aug 2026: 4.98% and rising; StatCounter agrees to within a point) and 4K is now the standard panel for TVs ≥43"; both share the same CSS pixel width, so one width tier serves both — device *class* (below), not width, is what tells them apart. |

Two widths do double duty by *class* rather than by width alone: `md` covers both "tablet" and "foldable unfolded", and `3xl` covers both "desktop 4K" and "TV/kiosk". `DEVICE_CLASSES` in `matrix.ts` carries the class-specific `pointer`/`hover`/`safeArea` overrides so code and design don't have to infer them from width alone (e.g. a `3xl` desktop is `pointer: fine, hover: true`, while a `3xl` TV/kiosk is `pointer: coarse, hover: false`).

A tier's range is `[minWidth, nextTier.minWidth)`; `3xl` is open-ended upward (covers 8K displays too, at the same design rules as 4K — there is not yet enough 8K browsing traffic to justify an eighth tier).

## 4. Device classes: test devices and input assumptions

| Class | Anchor tier | Pointer | Hover | Real test devices (cost, 2026 street price) | Emulated (Playwright/DevTools) |
|---|---|---|---|---|---|
| **Phone** | `xs`/`sm` | coarse | no | Mid-range Android (Galaxy A-series, ~$250) covers `xs`; a current iPhone (~$800+) covers `sm` plus iOS Safari quirks (`100vh`, safe-area, momentum scroll). | `PLAYWRIGHT_DEVICES.xs` / `.sm` (custom viewport, not a named preset — see §9). |
| **Tablet** | `md` | both | no (default) | A current base iPad (~$350) is the highest-value single tablet buy: covers iPadOS Safari, portrait+landscape, and (with an external keyboard/trackpad) the `any-pointer: fine` case. | `PLAYWRIGHT_DEVICES.md`. |
| **Laptop** | `lg` | both | yes | Whatever the team already develops on, at 1280×800 in the browser (not full-screen) — fractional DPR (1.25/1.5) should be tested via OS display scaling, not just DPR simulation. | `PLAYWRIGHT_DEVICES.lg`. |
| **Desktop** | `xl`/`2xl`/`3xl` | fine | yes | Existing dev monitors usually already cover 1080p/1440p; no purchase needed. | `PLAYWRIGHT_DEVICES.xl` / `.2xl` / `.3xl`. |
| **TV/kiosk** | `3xl` | coarse (remote/gamepad; touch on kiosks) | no | A budget 4K smart TV with a Chromium-based browser (webOS/Tizen/Google TV, ~$300–450) is the one *physical* purchase this ticket recommends beyond the phone/tablet above — remote-driven focus behavior does not reliably emulate in a desktop browser. | Chromium desktop at 3840×2160 approximates rendering but **not** input; remote/D-pad navigation must be verified on real hardware or a TV emulator. |
| **Foldable** | `xs`/`sm` folded, `md` unfolded | coarse | no | Not recommended as a physical purchase for this ticket's budget (see §8) — emulate via DevTools' "Fold" preset and Chromium's `device-posture` origin trial; revisit if a foldable-specific bug appears. | Chrome DevTools device toolbar "Galaxy Z Fold" preset; `(device-posture: folded)` / `(device-posture: continuous)` media queries once out of origin trial. |

### Three physical devices worth buying

1. **Mid-range Android phone** (e.g. Galaxy A-series or similar, ~$250) — covers `xs`, real touch/coarse pointer, real mobile Chrome.
2. **Current-generation iPad, base model** (~$350) — covers `md`, iPadOS Safari quirks, and doubles as the cheapest way to test `(any-pointer: fine)` on a touch-primary device once paired with a keyboard case or trackpad.
3. **Budget 4K smart TV with a built-in browser** (webOS/Tizen/Google TV, ~$300–450) — covers `3xl`-as-TV, real remote/D-pad focus traversal, and real 10-foot legibility, none of which a desktop browser at 3840×2160 can substitute for.

A current iPhone (~$800+) is the fourth-most-valuable purchase (covers `sm` plus iOS-only CSS quirks) but is deprioritized here only on cost; teams that already have one in the building should treat it as already covered.

## 5. Container queries vs. viewport breakpoints

Use **viewport breakpoints** (this matrix, via `matrix.ts`/media queries) for page-level, app-shell-level layout decisions: nav placement, whether a sidebar is persistent or a drawer, overall grid column count. Use **container queries** (`@container`, PAP-21) for any component that is reused at different widths *within* a page (a card in a 3-column grid vs. the same card full-width in a drawer) — the component should respond to the space it's actually given, not the viewport it happens to be inside. Container query (size) support is baseline in evergreen browsers per caniuse (2026); the risk surface is old embedded/kiosk Chromium (see §7), not modern desktop/mobile. Rule of thumb: if the answer to "does this need to know about the *page*" is yes, use a breakpoint; if it only needs to know its *own box*, use a container query.

## 6. DPR, safe areas, hover and pointer queries

- **DPR**: test at the `dpr` values listed per breakpoint in `matrix.ts`, not just 1x/2x/3x round numbers — Windows fractional scaling (1.25, 1.5) is the common case on `lg`/`xl`/`2xl`, not an edge case, per the Edge cases section of the ticket. Never assume `devicePixelRatio` is an integer.
- **Safe areas**: use `env(safe-area-inset-*)` on `xs`/`sm`/`md` (notches, punch-holes, rounded corners) and treat `3xl`-as-TV's overscan margin as a safe-area problem too (design a ~5% inset guide, even though there's no CSS `env()` value for TV overscan — most TV browsers already compensate, but kiosk deployments on bare panels may not).
- **Hover**: use `@media (hover: hover)` to gate hover-only affordances, never assume it from width — a `lg` laptop can be touch, an `md` tablet can have a mouse via a keyboard case.
- **Pointer**: use `@media (any-pointer: fine)` to *add* a precision affordance (e.g. a smaller resize handle) without removing the coarse-pointer fallback, per class in the table in §4.

## 7. TV/kiosk and 10-foot legibility

Design rules for anything rendered on `3xl`-as-TV/kiosk, driven by viewing distance rather than DPR:

- Minimum body text 24px CSS, minimum interactive-label text 28px, at 1x scale content — 4K at DPR 1 (i.e. authored at true 3840 CSS px, not scaled) means text sized for a desktop monitor viewed at arm's length will be illegibly small from a couch; content authored for 10-foot viewing should instead target roughly double the CSS pixel size of the desktop equivalent (or ship at DPR 2 so 1920 CSS-px layouts scale up cleanly — see §9).
- Focus rings: minimum 3px, high-contrast, always visible (never `:focus-visible`-only suppressed) — the primary input is a remote/D-pad, not a mouse, so a lost focus ring is a dead end, not an inconvenience.
- Navigation must be a strict, predictable linear order (D-pad up/down/left/right map onto DOM/tab order); nothing hover-only or drag-only (matches the org-wide input rule).
- State a minimum supported browser version for kiosk/TV Chromium builds explicitly (see §8) rather than assuming "modern Chromium" — embedded TV OS browsers lag stock Chrome by one to several major versions and are rarely user-updatable.
- Voice and gamepad/remote are **designed for now**, not added later: every interactive element needs a stable, human-readable intent phrase (the actions-registry rule) so a voice or D-pad controller can target it without bespoke per-page wiring.

## 8. Old kiosk browsers and minimum versions

Public kiosks and TV browsers can run Chromium in the 90-ish range for years past release (per the ticket's edge case), unlike auto-updating desktop/mobile Chrome. Recommendation: **Chromium 100 minimum** for full PaperOS UI (covers baseline `@container` queries and modern flex/grid; both landed by Chromium 105–106, so 100 is a deliberately conservative floor with a short buffer, not a guarantee of container-query support) with a documented degraded-but-usable fallback (flex/grid without container queries, viewport-only breakpoints) for anything older; below that, PaperOS should show a "please update your browser" notice rather than a silently broken layout. This is a policy recommendation for PAP-21 to implement, not a code change in this ticket's scope.

## 9. Edge cases (per the ticket)

- **Browser zoom 125–200%**: changes the *effective* CSS width (zoom divides the layout viewport), so a zoomed-in `xl` window can render as if it were `lg` or `md`. Layouts must be verified at zoom, not just at raw pixel widths — this is a testing-process note for PAP-82, not a new breakpoint.
- **Split-screen tablets**: produce widths between tiers (e.g. an iPad split 50/50 can land well under `md`'s 768 floor). Behavior is defined by falling through to the *next lower* tier's rules (a 500px-wide split-screen pane behaves like `sm`), per `breakpointForWidth()` in `matrix.ts` — there is no "in-between" undefined state.
- **Virtual keyboard shrinking `100vh`**: use `100dvh` (dynamic viewport height, baseline-supported per caniuse 2026) instead of `100vh`, and set `interactive-widget=resizes-content` in the viewport meta tag so the layout viewport — not just the visual one — resizes when the keyboard opens, avoiding the classic "content hidden behind the keyboard" bug.
- **Fractional DPR on Windows (1.25, 1.5)**: covered in §6 — always include a fractional value in the DPR test matrix for `lg`/`xl`/`2xl`, not just integers.
- **Old kiosk Chromium (~90-ish)**: covered in §8 — state and enforce a minimum version with a defined fallback rather than an undefined one.

## 10. Rejected alternatives

- **The ticket's original starting widths** (320/375/768/1024/1280/1536/1920 + optional `tv 3840`): rejected at the low end — 320/375 (iPhone SE-era) are no longer the dominant phone viewports (360/390 are, StatCounter 2026); rejected at the high end — collapsing 1440p into "≥1920" ignores that it's over a fifth of the desktop install base and growing (Steam, Aug 2026). Kept where it agreed: `768` and `1280` both check out against current data.
- **An eighth `tv` tier** instead of folding TV into `3xl`: rejected — the Interface contract's `BreakpointName` union is fixed at seven names, and TV/4K-desktop share an identical CSS width; the difference that matters (input, hover, legibility) is `DEVICE_CLASSES`, not a width tier.
- **Named Playwright device presets** instead of custom viewport configs: rejected for `PLAYWRIGHT_DEVICES` — presets drift with the installed Playwright version and aren't guaranteed to hit exactly these seven widths.
- **A physical foldable purchase**: rejected for this ticket's budget (§4) — the load-bearing data point (Z Fold7 unfolded = 984, inside `md`) is already confirmed from public specs; DevTools' fold emulation plus the `device-posture` origin trial cover day-to-day development.

## 11. Open questions for the 2027-01 review

- Does 4K desktop (`3xl` as workstation) cross a threshold that justifies a dedicated `4xl` tier once its input/legibility needs diverge further from TV/kiosk?
- Has the Device Posture API shipped outside an origin trial, warranting a first-class `posture` field on `matrix.ts`?
- Has any TV/kiosk Chromium fleet PaperOS deploys to fallen below the Chromium 100 floor in §8?
