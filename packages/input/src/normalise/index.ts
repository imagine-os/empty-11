/**
 * The normaliser: DOM and platform APIs in, `InputEvent` out.
 *
 * Nothing above this folder knows that Pointer Events, KeyboardEvent, WheelEvent
 * or the Gamepad API exist.
 */
export * from './dom.js';
export * from './gamepad.js';
export * from './ids.js';
export * from './keyboard.js';
export * from './pointer.js';
export * from './wheel.js';
