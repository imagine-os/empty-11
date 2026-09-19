import type { Locator, Page } from '@playwright/test';
import { THRESHOLDS } from '../thresholds.js';
import { centreOf, type Point, type Target } from './cdp.js';
import { sleep } from './errors.js';

/**
 * Drag helpers: the keyboard grammar of PAP-330 and a pointer drag that
 * crosses the drag-start threshold the way a person does.
 */

/** One step of the PAP-330 keyboard drag grammar. */
export type KeyboardDragMove =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'nextContainer'
  | 'prevContainer'
  | 'first'
  | 'last';

/** Grammar of PAP-330: arrows move, PageUp/PageDown change container, Home/End jump. */
export const KEYBOARD_DRAG_KEYS: Readonly<Record<KeyboardDragMove, string>> = Object.freeze({
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  nextContainer: 'PageDown',
  prevContainer: 'PageUp',
  first: 'Home',
  last: 'End',
});

export interface KeyboardDragOptions {
  /** Key that picks the item up. PAP-330 accepts Space and Enter. */
  readonly pickUp?: 'Space' | 'Enter';
  /** Key that drops it. PAP-330 drops on Space. */
  readonly drop?: 'Space' | 'Enter';
  /** Press Escape instead of dropping, to test cancel and focus restore. */
  readonly cancel?: boolean;
  /** Pause between keys, in ms, so announcements and re-renders can happen. */
  readonly stepDelayMs?: number;
}

/** Parse `'down down nextContainer'` into moves; throws on an unknown token. */
export function parseMoves(moves: string | readonly KeyboardDragMove[]): KeyboardDragMove[] {
  const tokens = typeof moves === 'string' ? moves.trim().split(/\s+/).filter(Boolean) : moves;
  return tokens.map((token) => {
    if (token in KEYBOARD_DRAG_KEYS) return token as KeyboardDragMove;
    throw new Error(
      `Unknown keyboard drag move ${JSON.stringify(token)}; expected one of ${Object.keys(KEYBOARD_DRAG_KEYS).join(', ')}`,
    );
  });
}

/** The key presses a keyboard drag produces. Pure; the unit test pins the grammar. */
export function keyboardDragKeys(
  moves: string | readonly KeyboardDragMove[],
  options: KeyboardDragOptions = {},
): string[] {
  const keys: string[] = [options.pickUp ?? 'Space'];
  for (const move of parseMoves(moves)) keys.push(KEYBOARD_DRAG_KEYS[move]);
  keys.push(options.cancel ? 'Escape' : (options.drop ?? 'Space'));
  return keys;
}

/**
 * Pick a handle up, move it and drop it, all from the keyboard: focus the
 * handle, `Space`, one arrow or page key per move, `Space` (or `Escape` with
 * `cancel: true`).
 */
export async function dragKeyboard(
  page: Page,
  handle: Locator,
  moves: string | readonly KeyboardDragMove[],
  options: KeyboardDragOptions = {},
): Promise<void> {
  await handle.focus();
  const stepDelayMs = options.stepDelayMs ?? 40;
  for (const key of keyboardDragKeys(moves, options)) {
    await page.keyboard.press(key);
    await sleep(stepDelayMs);
  }
}

export interface DragPointerOptions {
  /** Intermediate `mousemove` events between the threshold crossing and the target. */
  readonly steps?: number;
  /** Hold before moving, in ms; some sensors require a press-and-hold. */
  readonly holdMs?: number;
  /** Pause over the target before releasing, so drop zones can react. */
  readonly settleMs?: number;
  /** Offset added to the target centre, for dropping before or after a row. */
  readonly offset?: Point;
}

/** A point `distance` px from `from` in the direction of `to`. */
export function towards(from: Point, to: Point, distance: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { x: from.x + distance, y: from.y };
  return { x: from.x + (dx / length) * distance, y: from.y + (dy / length) * distance };
}

/**
 * Drag with the mouse from one target to another: press, cross the fine
 * drag-start threshold in one deliberate move, glide to the target in
 * `steps` moves, settle, release.
 */
export async function dragPointer(
  page: Page,
  from: Target,
  to: Target,
  options: DragPointerOptions = {},
): Promise<void> {
  const start = await centreOf(from);
  const end = await centreOf(to);
  const target = {
    x: end.x + (options.offset?.x ?? 0),
    y: end.y + (options.offset?.y ?? 0),
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await sleep(options.holdMs ?? 0);
  const threshold = towards(start, target, THRESHOLDS.dragStartPx.fine + 1);
  await page.mouse.move(threshold.x, threshold.y);
  await page.mouse.move(target.x, target.y, { steps: options.steps ?? 10 });
  await sleep(options.settleMs ?? 50);
  await page.mouse.up();
}
