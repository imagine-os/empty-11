---
id: "0019"
title: "Unified input event abstraction"
status: Accepted
date: 2026-09-19
deciders: ["Nova", "Iris", "Sentinel"]
issue: PAP-150
supersedes: []
supersededBy: null
tags: ["contract", "input", "accessibility"]
reviewDate: null
---

# 0019. Unified input event abstraction

* Status: Accepted
* Date: 2026-09-19
* Issue: [PAP-150](https://linear.app/paperos/issue/PAP-150)
* Deciders: Nova (decision), Iris (component contract), Sentinel (review)

## Context

PaperOS ships today for keyboard, mouse, trackpad, touch and pen, and is required to work with a
TV remote or gamepad d-pad and with voice next, on screens from 360 px to 3840 px read from ten
feet away. Thirteen issues build directly on however input is shaped here — the command registry
(PAP-151, PAP-289), gestures (PAP-154), drag-and-drop (PAP-155, PAP-329), pen (PAP-157), gamepad
(PAP-158), voice (PAP-159), focus management (PAP-152), the Playwright fixtures (PAP-644) and the
module contract (PAP-476) — and each of them would otherwise invent its own idea of what a press,
a chord or a direction is.

The forces:

* **Per-component device checks do not survive.** `if (pointerType === 'touch')` scattered across
  a component library means every new device class is a sweep through every component, and the
  branch nobody tests on is the one that breaks. The org standard is explicit: nothing hover-only,
  nothing drag-only, 44 px targets, every modality.
* **Voice and agents need the same vocabulary as the keyboard.** "Every page declares its actions
  (id, intent phrase, permission)" is a standing rule, and that registry is simultaneously the
  WebMCP surface, the voice controller's vocabulary and the command palette's source. If actions
  are declared somewhere other than the input contract, the three drift.
* **The platform APIs disagree with each other.** Pointer Events, Touch Events, `KeyboardEvent`,
  `WheelEvent` delta modes and the Gamepad API's poll-only snapshot each have different shapes,
  different units and different lifecycles, and browsers disagree within them (iOS Safari has no
  `pointerrawupdate`; Firefox reports line-mode wheel deltas; IMEs report keyCode 229).
* **The module boundary rule.** Other modules may import only `@paperos/contract-input` — types,
  schemas, ports — never implementation. Whatever is decided here has to be splittable into a
  contract package (PAP-476) without a rewrite.
* **English and Spanish from the start**, and a `Deferred`-free path to WCAG 2.1.4, 2.2.1 and
  2.5.7, which means thresholds have to be data, not constants buried in recognisers.

## Decision

We will define **one `InputEvent` discriminated union** in a new package `packages/input`
(`@paperos/input`), and every PaperOS component will switch on `kind`, never on device.

Specifics:

* **Eight kinds**, `press | move | release | cancel | wheel | key | gamepad | voice`, sharing one
  envelope (`id` UUID, `contract` version, monotonic `timeStamp`, `modality`, `modifiers`,
  `surfaceId`). Mouse, touch, pen and the synthetic gamepad cursor all arrive as the four pointer
  kinds with identical fields — `pressure`, `tiltX/Y`, `twist` and contact geometry are present on
  every pointer, not only on a pen.
* **`modality` is for affordances only** — hit-target size, focus rings, hover hints — never for
  behaviour. A behavioural branch on `modality` is a review failure.
* **Zod 4 is the source of truth.** Schemas live in `packages/input/src/contract/`, a folder that
  imports nothing from above it, so PAP-476 lifts it out verbatim as `@paperos/contract-input`.
  JSON Schema (draft 2020-12) is generated from the Zod schemas into
  `packages/input/src/schema/*.schema.json` and committed; a test fails on a stale copy.
* **Capture and the cancel guarantee.** `press` takes pointer capture; exactly one `release` or
  `cancel` fires per pointer id; `cancel` covers `pointercancel`, lost capture, window blur, a
  hidden tab and palm rejection, each with a named `reason`.
* **Chords are stored once, portably.** `mod+shift+k`, with `mod` resolved to Cmd on macOS and
  Ctrl elsewhere at match and format time. Letters and digits match on `KeyboardEvent.code`,
  symbols on `key`, and matching is suppressed while `isComposing` is true.
* **Directional input is `navigation`, not buttons.** A d-pad press (or the left stick past the
  deadzone) carries `{ direction, repeat, mode }`; `nearestInDirection()` resolves it against
  rectangles. A component never reads a button index, and arrow keys share the path.
* **Voice is an action id, not keystrokes.** A `voice` event carries `actionId`, `transcript`,
  `confidence`, `locale`, `slots` and `final`, so every voice interaction is auditable and only
  final, sufficiently confident results run.
* **Actions are declared in this contract.** `defineAction({ id, titleKey, intent: { en, es },
  permission, scope, shortcut, agentCallable, placeholder, argsSchema, run })`. Both locales are
  required by the schema. The serialisable half is the actions registry, which is the WebMCP
  surface, the voice vocabulary and the input to `docs/reference/surfaces.md`.
* **Thresholds are exported data** (`THRESHOLDS`), so gestures, drag-and-drop, pen and gamepad
  agree and an accessibility preference can scale them in one place.
* **The core is framework-free.** React appears only in `src/react/`, behind an optional peer
  dependency; `src/normalise/` is the only layer that knows the DOM exists, and it is typed against
  structural shapes so it can be driven by a fixture, a polyfill or a real browser event alike.
* **A thin standalone layer over Pointer Events**, not `@use-gesture/react`, for the core.
  `@use-gesture` remains available to PAP-154 for pinch and wheel maths only.

Reference: [`docs/platform/input-events.md`](../platform/input-events.md).

## Consequences

**Positive.** A component is written once and works with a finger, a pen, a d-pad and a voice.
Adding a device class is a new branch of the union plus a normaliser, not a sweep through the
component library. The chord vocabulary, the thresholds and the action shape are fixed before
thirteen dependent issues start, which is the cheapest moment to fix them. Golden fixtures make any
change to the vocabulary a reviewable diff, and the generated JSON Schema lets the WebMCP surface,
the voice loader and external callers validate events without running TypeScript.

**Negative.** One union for eight sources is a compromise: `wheel` carries fields no pointer needs
and `gamepad` carries `axes` a keyboard never has, so consumers narrow before they read. Every
event allocates a UUID and a modifiers object, which is measurable on a `pointermove` flood —
mitigated by coalesced moves, and to be re-measured against the canvas (PAP-127) before v0.2. We
own a normaliser per platform API forever, including the browser quirks the vendors will keep
adding. Requiring Spanish intent phrases at declaration time will be felt as friction by whoever
declares the first fifty actions; that is the intended trade.

**Neutral.** `zod` enters the workspace as this package's first runtime dependency (no
`catalog:` entry exists yet, so the version is declared locally at `^4.6.5`; a root `catalog:`
entry is the obvious follow-up once a second package needs it). `packages/input/biome.json` is a
nested Biome config that excludes the two generated JSON folders from formatting, because generated
output and a formatter always disagree.

## Alternatives rejected

**Per-component device handling (the status quo everywhere else).** Each component listens to the
DOM events it cares about. It is the least code today and it is why so many products have a
touch-hostile toolbar and a keyboard-hostile canvas; it also gives voice and agents nothing to
read. It would change the answer if PaperOS only ever ran in one browser on one device class.

**`@use-gesture/react` as the core layer.** Mature pinch and wheel maths, and a React-idiomatic
API. Rejected as the core because it is React-only (the shell, the CLI surfaces and the
conformance suite are not), it models gestures rather than an event vocabulary, and it has no
concept of gamepad, remote or voice — we would still be defining this union on top of it. It stays
available to PAP-154 for the pinch and wheel maths, which is the part that is genuinely hard.

**Re-using the DOM `PointerEvent` shape directly and adding sidecars for the rest.** Zero
translation for the common case. Rejected because the DOM shape cannot be constructed in Node, is
not serialisable, differs between browsers in exactly the fields we depend on, and drags `lib.dom`
into every consumer including the contract package that must stay pure.

**Separate per-device event types (`TouchEvent`, `PenEvent`, `GamepadEvent`) with a mapping layer
in each component.** Honest about the differences. Rejected because it pushes the union into every
consumer — the same device branch we are trying to delete, only spelled with types.

**TypeScript types only, no Zod.** Lighter, no runtime dependency. Rejected because the events
cross process and window boundaries (agents, WebMCP, multi-window, recorded fixtures) where a type
buys nothing, and because the JSON Schema the WebMCP surface and the voice loader need has to come
from somewhere. Zod 4's `z.toJSONSchema` makes the schemas the single source and the JSON a build
artefact.

## Re-open criteria

This decision is revisited when any of these becomes true:

- **Fact.** A shipped device class does not fit the union — an eye tracker, a BCI, or a platform
  whose directional input is not expressible as `{ direction, repeat, mode }`.
- **Fact.** The W3C ships a standard that already covers pointer, keyboard, gamepad and voice in
  one vocabulary, making this package redundant.
- **Budget.** Event allocation on a `pointermove` flood costs more than 1 ms per frame in the
  canvas (PAP-127) at 1920 px, measured, after coalescing.
- **Fact.** `@use-gesture` or a successor grows a framework-free core with device-class coverage,
  which would make the standalone layer a maintenance burden with no benefit.

Re-opening means a new ADR that supersedes this one and a major version bump of
`@paperos/contract-input` with an upcaster for recorded fixtures.

## References

- Linear issue: PAP-150 (blocks PAP-151, PAP-154, PAP-155, PAP-157, PAP-158, PAP-289, PAP-329,
  PAP-476, PAP-641, PAP-644, PAP-651, PAP-911)
- Reference doc: [`docs/platform/input-events.md`](../platform/input-events.md)
- Package: [`packages/input/README.md`](../../packages/input/README.md)
- Module System: `docs/module-system.md` (plan mirror), row `input` → `contract-input`
- Pointer Events Level 3, UI Events, Gamepad API (standard mapping), WCAG 2.2 AA 2.1.1, 2.1.4,
  2.2.1, 2.5.7, 2.5.8
