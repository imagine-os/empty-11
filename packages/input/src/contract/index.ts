/**
 * `@paperos/input/contract` — the pure half of the input module.
 *
 * Types, Zod 4 schemas and constants only: no DOM access, no React, no I/O.
 * PAP-476 lifts this folder out verbatim as `@paperos/contract-input`, so
 * nothing here may import from `../` (lint rule R9 will enforce it).
 */

export * from './action.js';
export * from './event.js';
export * from './gamepad.js';
export * from './keyboard.js';
export * from './modality.js';
export * from './pointer.js';
export * from './primitives.js';
export * from './version.js';
export * from './voice.js';
