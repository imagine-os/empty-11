/**
 * `@paperos/input` — one input model for every device.
 *
 * Mouse, touch, pen, keyboard, wheel, gamepad, TV remote and voice arrive as
 * one `InputEvent` union, so a component switches on what happened and never
 * on what kind of hardware did it. `modality` rides along for affordances only
 * — hit-target size, focus rings, hover hints — never for behaviour.
 *
 * Layout:
 *
 * * `contract/` — pure types, Zod 4 schemas and constants. PAP-476 lifts this
 *   folder out verbatim as `@paperos/contract-input`; nothing in it imports
 *   from above.
 * * `normalise/` — the only code that knows the DOM and the Gamepad API exist.
 * * `modality/`, `focus/`, `chord/` — framework-free behaviour.
 * * `react/` — optional hooks, behind an optional peer dependency.
 *
 * Spec: PAP-150. Decision: ADR 0019. Reference: docs/platform/input-events.md.
 */

export * from './chord/index.js';
export * from './contract/index.js';
export * from './focus/index.js';
export * from './modality/index.js';
export * from './normalise/index.js';
export * from './thresholds.js';
