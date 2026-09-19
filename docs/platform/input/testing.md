# Input testing fixtures: `@paperos/input/testing`

Owner: input (Nova), PAP-644. Package entry: [`packages/input/src/testing/`](../../../packages/input/src/testing/index.ts).
Builds on [`input-events.md`](../input-events.md) (PAP-150): chords, thresholds and the
`data-input-*` contract are imported from the package, never re-declared.

Every input, tables and quality spec writes Playwright tests that press chords, long-press,
pinch, drag by keyboard or mock a gamepad. This entry ships those helpers once, so a test reads
like the spec it checks and Gate 3, PAP-156 and the tables e2e all exercise the same gestures.

## 1. Use it

```ts
import { expect, test } from '@paperos/input/testing';

test('command palette opens on mod+k', async ({ page, input }) => {
  await page.goto('/');
  await input.pressChord('mod+k');            // Meta+K on a macOS UA, Control+K elsewhere
  await expect(page.getByRole('dialog')).toBeVisible();
  await input.expectModality('keyboard');
});
```

`test` is Playwright's `test.extend({ input })`; keep extending it as usual. The entry is pure
Playwright: no React, no app import, so `packages/quality` and any gate can depend on it without
pulling the UI. Add `"@playwright/test": "1.56.1"` to your package (the same version the input
package pins; it is an optional peer) and point your `playwright.config.ts` at the app.

Every helper also exists as a standalone function taking `page` first
(`pressChord(page, 'mod+k')`, `tap(page, locator)`), for use outside a test body.

## 2. Helpers, one example each

| Helper | Example | Notes |
| -- | -- | -- |
| `pressChord(chord, { platform?, delayMs? })` | `await input.pressChord('mod+shift+k')` | `mod` resolves from the **page's** `navigator.platform` / `userAgentData.platform`, not the runner. |
| `sequence(chords, { gapMs? })` | `await input.sequence('g i', { gapMs: 80 })` | Whitespace-separated chords, realistic gap. |
| `holdKey(chord, ms, { repeat? })` | `await input.holdKey('space', 700)` | Emulates OS auto-repeat (`keydown` with `repeat: true` after 500 ms, every 50 ms); `repeat: false` holds silently. |
| `tap(target, { slopPx?, durationMs? })` | `await input.tap(card, { slopPx: 4 })` | CDP touch. Slop under `THRESHOLDS.tapSlopPx.coarse` stays a tap. |
| `longPress(target, { holdMs? })` | `await input.longPress(row)` | Default hold is `THRESHOLDS.longPressMs + 100`. |
| `swipe(target, { direction, distancePx?, durationMs? })` | `await input.swipe(row, { direction: 'left' })` | Fast by default (200 ms) so velocity recognisers read a fling. |
| `pan(target, { dx, dy, steps?, durationMs?, holdMs? })` | `await input.pan(map, { dx: 120, dy: 0 })` | One finger, evenly timed moves. |
| `pinch(target, { scale?, startDistancePx? })` | `await input.pinch(map, { scale: 2 })` | Two fingers; `scale < 1` pinches in. |
| `pen(target, strokes, { pressure?, durationMs? })` | `await input.pen(canvas, [[{ x: 10, y: 10 }, { x: 90, y: 60, pressure: 0.9 }]])` | Points relative to the target's top-left. CDP `pointerType: 'pen'` with `force`, tilt and twist. |
| `penTap(target, point)` | `await input.penTap(canvas, { x: 20, y: 20 })` | One-point stroke. |
| `gamepad()` | `const pad = await input.gamepad(); await pad.connect(); await pad.press('a'); await pad.stick('left', 1, 0)` | Installs a `navigator.getGamepads()` mock the page polls; buttons by contract name (`a`, `b`, `up`, `start`, …). `connect({ id: 'TV Remote', axes: 0 })` reads as a remote. |
| `dragKeyboard(handle, moves, { pickUp?, cancel? })` | `await input.dragKeyboard(handle, 'down down')` | PAP-330 grammar: Space/Enter picks up, arrows move, PageUp/PageDown change container, Home/End jump, Space drops, `cancel: true` presses Escape. |
| `dragPointer(from, to, { steps?, holdMs?, offset? })` | `await input.dragPointer(row, target, { offset: { y: -8 } })` | Crosses `THRESHOLDS.dragStartPx.fine` in one deliberate move, then glides. |
| `expectModality(expected, { which? })` | `await input.expectModality('pointer')` | Reads `data-input-preferred` (or `current`) on `<html>`; `'pointer'` accepts mouse, touch, pen. Polls. |
| `expectAnnouncement(matcher, { politeness? })` | `await input.expectAnnouncement(/Moved .* to position 3/)` | Reads the shared live region. No region at all fails with "mount `LiveAnnouncer`". |
| `touchTargets({ minPx?, within?, coarseOnly? })` | `const report = await input.touchTargets()` | Measures every visible interactive element; violations carry a selector, label and size. Consumed by PAP-82. |
| `expectTouchTargets(options)` | `await input.expectTouchTargets()` | Fails listing every element under 44 × 44 CSS px. |

Pure planners (`planTap`, `planPinch`, `planPen`, `keyboardDragKeys`, `toPlaywrightKey`,
`installGamepadMock`, `auditTouchTargets`) are exported too; they are what the Vitest unit tests
pin, and what a consumer with different timing needs can feed to `dispatchTouch` / `dispatchPen`.

## 3. Browser support

| Helper | Chromium | Firefox | WebKit |
| -- | -- | -- | -- |
| chords, sequence, holdKey | yes | yes | yes |
| gamepad mock | yes | yes | yes |
| dragKeyboard, dragPointer | yes | yes | yes |
| expectModality, expectAnnouncement, touchTargets | yes | yes | yes |
| tap, longPress, swipe, pan, pinch | yes (CDP) | **skip** | **skip** |
| pen, penTap | yes (CDP) | **skip** | **skip** |

Firefox and WebKit expose no Chrome DevTools Protocol. Through the `input` fixture the CDP
helpers call `test.skip()` with a message naming the helper and the fix; the standalone functions
throw `CdpUnavailableError`. Nothing silently passes. Headless WebKit additionally ignores
`pointerType: 'pen'` even for native dispatch, so pen coverage is Chromium-only by design.

## 4. DOM contracts the assertions read

* **Modality** (PAP-150): `data-input-modality` and `data-input-preferred` on `<html>`, written by
  `createModalityDetector().syncAttributes()` or the React provider.
* **Announcer** (PAP-152, soft until it lands): a `data-live-announcer` root with one `aria-live`
  region per politeness. Plain `[aria-live]`, `role="status"` and `role="alert"` regions are
  accepted as a fallback. `expectAnnouncement` restricts by `politeness` when asked.
* **Keyboard drag** (PAP-330, soft): the key grammar in the table above. If PAP-330 changes a key,
  change `KEYBOARD_DRAG_KEYS` here in the same commit.
* **Test-mode hooks** (PAP-240, soft): none required. Consumers seed through `/__test/*` and then
  drive input with this fixture.

## 5. Self-tests

```bash
pnpm --filter @paperos/input test          # Vitest: chord translation, gesture timing, gamepad state machine, drag grammar, audit
pnpm --filter @paperos/input test:e2e      # Playwright, chromium: every helper against e2e/self-test.html
pnpm --filter @paperos/input test:e2e:all  # adds firefox and webkit (CDP helpers skip there)
```

The self-test page ([`packages/input/e2e/self-test.html`](../../../packages/input/e2e/self-test.html))
is static: it records every DOM event into `window.__log`, implements the PAP-330 grammar with
announcements, polls `navigator.getGamepads()` like a real consumer, mirrors the modality onto
`<html>` and draws pen strokes with pressure. No app, no server, so the suite never blocks on an
app build. The Playwright suite is outside `pnpm check` because CI does not install browsers yet
(follow-up on the CI workflow); the Vitest planners are inside it.

## 6. Edge cases

* **`mod` on a Linux runner emulating macOS**: resolved from the page, so `Meta+K` is pressed
  against a `platform: 'MacIntel'` page. Pass `{ platform: 'other' }` to override.
* **Tap wobble**: Chromium applies its own touch slop, so a `slopPx` under it produces no DOM
  `touchmove`; that is what a real tap looks like and the self-test asserts it.
* **Coalescing**: browsers merge `touchmove` and `pointermove` per frame. Assert on outcomes, not
  event counts.
* **Missing announcer**: `expectAnnouncement` throws `MissingContractError` with the markup to mount.
* **Missing modality attribute**: `expectModality` fails after its poll with the detector call to add.
