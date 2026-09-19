# Input events: one model for mouse, touch, pen, keyboard, gamepad, remote and voice

Owner: input (Nova), PAP-150. Decision: [ADR 0019](../adr/0019-input-events.md).
Package: [`@paperos/input`](../../packages/input/README.md). Generated JSON Schema:
`packages/input/src/schema/`.

This is the vocabulary every PaperOS component handles input in. It exists so that "works with a
mouse" and "works with a finger, a pen, a d-pad and a voice" are the same piece of code, written
once, rather than four branches that drift apart.

---

## 1. The rule

**Switch on what happened, never on what did it.**

```ts
// Yes
if (event.kind === 'press') startDrag(event.pointer);

// No
if (event.pointerType === 'touch') { … } else if (event.pointerType === 'mouse') { … }
```

`event.modality` exists, and it is for *affordances only*: how big the hit target is, whether the
focus ring shows, whether a hover hint is worth rendering. The moment a behaviour differs by
modality, one of the modalities is about to be broken — usually the one nobody tests on.

Three consequences follow directly, and they are the standards this repo is held to:

* **Nothing hover-only.** A finger, a pen and a d-pad have no hover state. Anything reachable only
  by hovering is unreachable on three of the six input classes we ship for.
* **Nothing drag-only.** Every drag has a keyboard and a command equivalent (PAP-330).
* **44 px targets.** `THRESHOLDS.minTargetPx`. A coarse pointer does not become finer because the
  screen got bigger, and a 4K TV read from ten feet away is the coarsest pointer of all.

---

## 2. The event

`InputEvent` is a discriminated union on `kind`, with eight members:

| `kind` | Produced by | Carries |
| -- | -- | -- |
| `press` | pointerdown (mouse, touch, pen, gamepad cursor) | `pointer` |
| `move` | pointermove / pointerrawupdate | `pointer`, `coalesced[]` |
| `release` | pointerup | `pointer` |
| `cancel` | pointercancel, lost capture, blur, hidden tab, palm rejection | `pointer`, `reason` |
| `wheel` | wheel, trackpad, pinch | `deltaX/Y/Z` in pixels, `isTrackpad`, `ctrlKey`, `position` |
| `key` | keydown / keyup, mouse side buttons | `key`, `chord`, `phase` |
| `gamepad` | Gamepad API polling (controller or TV remote) | `device`, `button`, `value`, `axes`, `navigation` |
| `voice` | the voice controller | `intent` (action id, transcript, confidence, slots) |

Every event carries the same envelope: a UUID `id`, the `contract` version that produced it, a
monotonic `timeStamp`, `modality`, `modifiers` and the `surfaceId` it was delivered to. The id and
the version are not decoration — they are what makes an event loggable, replayable across a window
boundary (PAP-646) and auditable when an agent ran it.

### Coordinates

Every pointer carries three spaces, all in CSS pixels:

| Space | Origin | Use |
| -- | -- | -- |
| `client` | viewport | comparing against `getBoundingClientRect()` |
| `page` | document | survives scrolling |
| `surface` | the bound element | **the only space a component should do arithmetic in** |

### Pressure, tilt and the pen

`pressure`, `tangentialPressure`, `tiltX`, `tiltY` and `twist` are present on *every* pointer, not
only on a pen. Mouse and touch report `pressure: 0.5` while down and `0` while hovering, which the
normaliser enforces even on browsers that report `0` on a press. A pressure-aware brush therefore
needs no device check: it just draws thinner with a mouse.

The barrel button and the right mouse button are the same bit (`BUTTON_BITS.secondaryBarrel`).
Treat them the same; a pen user expects the barrel to open the context menu.

**Palm rejection.** While a pen is active, touch presses on the same surface are ignored for
`THRESHOLDS.penPalmRejectionMs` (300 ms) and any touch already down is cancelled with
`reason: 'palm-rejection'`. A hand resting on a tablet must not draw.

### Capture and the cancel guarantee

`press` takes pointer capture on the surface. The guarantee consumers rely on is:

> **Exactly one `release` or `cancel` per pointer id.**

`cancel` is delivered on `pointercancel`, on `lostpointercapture`, on window blur and on a hidden
tab. A consumer that only handles `release` leaks state the first time someone alt-tabs mid-drag,
which is why `cancel` is a first-class member of the union rather than an error path.

### Wheel and trackpad

`deltaMode` never reaches a consumer: line mode is multiplied by 16 px and page mode by the
viewport height, so Firefox and Chrome scroll the same distance. `isTrackpad` is inferred from
fractional deltas, small magnitudes and burst cadence, and is sticky for the length of a burst.
`ctrlKey` with a wheel is the browser's pinch-zoom signal on every platform, so it is promoted out
of `modifiers` to a named field.

Mouse buttons 3 and 4 are emitted as `key` events with the synthetic codes `MouseBack` and
`MouseForward`, which the default keymap binds to `nav.back` / `nav.forward`. They are keys, not
pointers: nobody wants a drag gesture on the back button.

### Keyboard and chords

`key` normalises to `{ code, key, repeat, isComposing, location }` and computes the portable
`chord` string.

* **Letters and digits match on `code`** (the physical key), so `mod+k` works on AZERTY and on a
  Cyrillic layout.
* **Symbols match on `key`** (the produced character), because their physical code moves between
  layouts.
* **`mod` is Cmd on macOS and Ctrl everywhere else.** Chords are stored once, in that spelling, and
  rendered per platform by `formatChord`: `⇧⌘K` or `Ctrl+Shift+K`.
* **`isComposing` blocks matching.** `matchChord` returns false mid-IME-composition, and infers
  composition from the legacy 229 keyCode where that is the only signal. Typing Japanese must not
  fire shortcuts.

```ts
matchChord(event, 'mod+shift+k', platformFrom(navigator.platform));
formatChord('mod+shift+k', 'mac'); // "⇧⌘K"
```

### Gamepad, TV remote and focus navigation

The Gamepad API has no events, only a polled snapshot, so `createGamepadDiffer()` turns successive
snapshots (from `requestAnimationFrame`) into `press` / `repeat` / `release`. Buttons are named
(`a`, `l1`, `up`), never indexed.

A d-pad press — and the left stick pushed past the deadzone, so a controller without a d-pad still
works — carries `navigation: { direction, repeat, mode }`. **That is the whole interface for
directional input.** A component reads `navigation.direction` and moves focus; it never sees a
button index.

A pad whose id looks like a TV remote, or which reports no sticks, is classified `role: 'remote'`
and reports `modality: 'remote'`, because the affordances differ: no cursor, focus only, and the
ten-foot legibility rules apply.

Held directions auto-repeat after 400 ms at 90 ms intervals, tagged `phase: 'repeat'`, so a long
list scrolls while a dialog can ignore the repeats.

### Voice

The voice controller does not synthesise keystrokes. It resolves an utterance against the actions
registry and emits:

```ts
{ kind: 'voice', intent: { actionId, transcript, confidence, locale, slots, final, matchedPhrase } }
```

Only `final` results may run an action. `confidence` at or above `VOICE_CONFIRM_ABOVE` (0.8) runs
directly; between that and `VOICE_REJECT_BELOW` (0.4) the page confirms; below it the utterance is
discarded. The transcript travels with the event so the whole interaction is auditable.

---

## 3. Modality: capabilities versus preference

Two different questions, answered separately, because conflating them is how touch laptops end up
broken:

* **`capabilities`** — *what can this device do?* Media queries (`(pointer: coarse)`,
  `(any-pointer: fine)`, `(any-hover: hover)`) plus what has been observed. **Sticky:** a flag only
  ever turns on. A tablet handed a keyboard keeps its touch affordances.
* **`preferred`** — *what is the person using right now?* Only a **deliberate** interaction
  switches it: a press, a key-down, a d-pad press, a final voice intent. A bare pointer `move` does
  not, so a mouse nudged while someone is typing does not steal the focus ring.

```ts
const detector = createModalityDetector({ matchMedia, navigator, documentElement, now });
detector.observe(inputEvent);
preferredModalitySignal(detector).subscribe((modality) => …);
```

The state is mirrored onto `<html>` so CSS can respond with no JavaScript in the render path:

| Attribute | Meaning |
| -- | -- |
| `data-input-modality` | the last modality seen |
| `data-input-preferred` | the sticky answer components style against |
| `data-input-coarse` / `data-input-fine` | pointer precision |
| `data-input-hover` | hover can be relied on |
| `data-input-pen` / `data-input-gamepad` / `data-input-remote` | device observed |

```css
:root[data-input-coarse] .toolbar-button { min-block-size: 44px; }
:root:not([data-input-hover]) .hover-hint { display: none; }
```

React: `useLastInputModality()`, `useInputCapabilities()`, `useInputDataAttributes()`.

---

## 4. Spatial focus navigation

A TV remote has four keys and no cursor, so "next" has to mean *the thing that looks next*, not the
next node in the DOM.

```ts
nearestInDirection(originRect, candidates, 'down');
const nav = createSpatialNavigator(() => candidates);
nav.move('right');
```

Scoring, in order: only candidates strictly ahead are eligible (1 px tolerance, so adjacent table
cells that share an edge count); a candidate overlapping the origin's cross-axis projection beats
one that does not, however close the latter is — this is what makes a grid feel like a grid; then
`travel + 2 × crossAxisOffset`, discounted 25 % for a candidate in the same `group`, which keeps
focus inside a toolbar or a row. Ties break on travel distance, then candidate order, so the result
is deterministic and a fixture can pin it.

With nothing focused, the first press enters from the middle of the edge it came from: `down` lands
on the top-middle candidate. `getCandidates` is re-read on every move, so a virtualised list needs
no invalidation. Arrow keys share the path through `ARROW_DIRECTIONS`.

---

## 5. The actions registry

Every page declares its actions. One declaration serves four consumers, which is why it lives in
the input contract rather than in any one of them:

```ts
defineAction({
  id: 'record.duplicate',                       // dot-namespaced, stable, unique
  titleKey: 'record.action.duplicate',          // message-catalog key, never a literal
  intent: {                                     // both locales, always
    en: ['duplicate this record', 'copy this record'],
    es: ['duplicar este registro'],
  },
  permission: 'record:write',
  shortcut: 'mod+d',
  agentCallable: true,
  run: (ctx) => duplicate(ctx.args),
});
```

| Consumer | Reads |
| -- | -- |
| Command registry (PAP-151, PAP-289) | `id`, `titleKey`, `shortcut`, `scope`, `permission` |
| Voice controller (PAP-159, PAP-653) | `intent.en` / `intent.es`, `slots` placeholders |
| WebMCP surface | `agentCallable`, `permission`, `argsSchema` |
| Native menu, palette, docs | all of it, from `actions.registry.json` |

`run` is a function, so it is never serialised; `ActionDeclarationSchema` validates everything that
crosses a wire, and `toDeclaration()` strips the handler. Both locales are **required** by the
schema — Spanish is a pass, never a blocker, and an action with no Spanish phrase fails at module
load rather than silently at the microphone.

`placeholder: true` marks an action that is declared but not wired: the UI shows a tooltip and a
"not wired yet" toast, always visible in dev mode.

**A UI change that adds, renames or removes a control updates this declaration in the same commit.**
There is no second source of truth, and `docs/reference/surfaces.md` is generated from it.

---

## 6. Thresholds

Exported constants, not magic numbers, so gestures, drag-and-drop, pen and gamepad agree and an
accessibility preference (WCAG 2.2.1 timing extensions) can scale them in one place.

| Constant | Fine | Coarse |
| -- | -- | -- |
| `tapSlopPx` | 8 | 12 |
| `dragStartPx` | 4 | 10 |

| Constant | Value |
| -- | -- |
| `longPressMs` | 500 |
| `doublePressMs` | 300 |
| `penPalmRejectionMs` | 300 |
| `gamepadDeadzone` | 0.25 (rescaled so the usable range is still [0, 1]) |
| `gamepadRepeatDelayMs` / `gamepadRepeatIntervalMs` | 400 / 90 |
| `minTargetPx` | 44 |
| `wheelLineHeightPx` | 16 |

---

## 7. Layers and what may import what

```
contract/   types, Zod schemas, constants        ← pure; becomes @paperos/contract-input (PAP-476)
normalise/  DOM and Gamepad API → InputEvent     ← the only DOM-aware layer
chord/ modality/ focus/                          ← framework-free behaviour
react/                                           ← optional peer; nothing else imports it
```

Consumers import `@paperos/input`; other modules import only `@paperos/contract-input` once
PAP-476 publishes it. Nothing outside `normalise/` may touch a DOM event, and nothing outside
`react/` may import React.

## 8. Not in this package

Gesture recognisers and the arena (PAP-154, `r4/input/gesture-recognisers-and-arena`),
drag-and-drop (PAP-155, PAP-329), the command registry and palette (PAP-151, PAP-289, PAP-290),
keymaps (PAP-153), focus regions and the live announcer (PAP-152), the voice backend (PAP-159,
`r4/input/voice-backend-and-intent-matching`), the undo manager and clipboard port. All of them
build on the vocabulary above; none of them redefines it.
