# @paperos/input

One input model for every device. Owner: input (Nova), PAP-150 onwards. Decision: [ADR 0019](../../docs/adr/0019-input-events.md). Reference: [`docs/platform/input-events.md`](../../docs/platform/input-events.md); testing fixtures: [`docs/platform/input/testing.md`](../../docs/platform/input/testing.md).

Mouse, touch, pen, keyboard, wheel, gamepad, TV remote and voice all arrive as one `InputEvent`
union, so a component switches on *what happened* and never on *what kind of hardware did it*.

```
src/contract/   Pure types, Zod 4 schemas, constants. PAP-476 lifts this folder out verbatim
                as @paperos/contract-input, so nothing in it imports from above.
src/normalise/  The only code that knows Pointer Events, KeyboardEvent, WheelEvent and the
                Gamepad API exist.
src/chord/      parseChord / formatChord / matchChord — portable `mod+shift+k`.
src/modality/   Capability detection, the preferredModality signal, data-input-* on <html>.
src/focus/      nearestInDirection — spatial focus navigation for the d-pad.
src/schema/     Generated JSON Schema (pnpm gen:schemas). Never hand-edited.
src/fixtures/   Raw device inputs and the golden normalised stream (pnpm gen:fixtures).
src/react/      Optional hooks. React is an optional peer; the core is framework-free.
src/testing/    @paperos/input/testing — the shared Playwright `input` fixture (PAP-644):
                chords, CDP touch and pen, gamepad mock, drag grammar, modality / announcement /
                touch-target assertions. Pure Playwright, no app import. Self-test page in e2e/.
```

| Script | Does |
| -- | -- |
| `pnpm --filter @paperos/input test` | Vitest, jsdom |
| `pnpm --filter @paperos/input gen:schemas` | rewrite `src/schema/*.schema.json` from the Zod schemas |
| `pnpm --filter @paperos/input gen:fixtures` | rewrite `src/fixtures/golden/events.json` |
| `pnpm --filter @paperos/input test:e2e` | Playwright self-tests of `src/testing/` on chromium against `e2e/self-test.html` |
| `pnpm --filter @paperos/input test:e2e:all` | same on chromium, firefox and webkit (CDP helpers skip off chromium) |

The generated files are committed and a test fails when a copy is stale.
