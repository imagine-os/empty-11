/**
 * `@paperos/input/testing` — shared Playwright input fixtures.
 *
 * Tests read like the specs: `input.pressChord('mod+shift+k')`,
 * `input.longPress(card)`, `input.pinch(map, { scale: 2 })`,
 * `input.pen(canvas, strokes, { pressure: 0.8 })`,
 * `(await input.gamepad()).press('a')`, `input.dragKeyboard(handle, 'down down')`,
 * `input.expectModality('keyboard')`, `input.expectAnnouncement(/Moved/)`,
 * `input.expectTouchTargets()`.
 *
 * Pure Playwright: no React, no app import, so quality packages can depend on
 * this entry without pulling the UI. Chord and threshold semantics come from
 * the package itself (`../chord`, `../thresholds`, `../contract`), never
 * re-declared here. Spec: PAP-644. Docs: docs/platform/input/testing.md.
 */

export * from './cdp.js';
export * from './chords.js';
export * from './drag.js';
export * from './errors.js';
export * from './fixture.js';
export * from './gamepad.js';
export * from './modality.js';
export * from './pen.js';
export * from './touch.js';
