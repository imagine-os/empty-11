import type { Page } from '@playwright/test';
import type { Direction } from '../contract/primitives.js';
import { THRESHOLDS } from '../thresholds.js';
import { cdpSession, centreOf, type Point, type Target } from './cdp.js';
import { sleep } from './errors.js';

/**
 * Touch gestures over CDP `Input.dispatchTouchEvent`.
 *
 * Each gesture is first *planned* as a list of timed touch steps (pure, unit
 * tested), then *dispatched* with real pauses so recognisers that measure
 * time (long press, fling velocity) see what a finger would produce.
 * Chromium only: Firefox and WebKit expose no CDP, and the helpers throw a
 * `CdpUnavailableError` rather than pretending the gesture happened.
 */

export interface TouchPoint {
  readonly x: number;
  readonly y: number;
  /** Stable identifier per finger across a gesture. */
  readonly id: number;
  readonly radiusX?: number;
  readonly radiusY?: number;
  readonly force?: number;
}

export type TouchStepType = 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel';

export interface TouchStep {
  readonly type: TouchStepType;
  /** Every finger still on the surface after this step. */
  readonly touchPoints: readonly TouchPoint[];
  /** Milliseconds since the gesture began. */
  readonly atMs: number;
}

const FINGER = { radiusX: 11, radiusY: 11, force: 0.6 } as const;

function finger(point: Point, id: number): TouchPoint {
  return { x: point.x, y: point.y, id, ...FINGER };
}

/** Evenly spaced positions from `from` to `to`, excluding `from`, including `to`. */
function interpolate(from: Point, to: Point, steps: number): Point[] {
  const count = Math.max(1, Math.floor(steps));
  const points: Point[] = [];
  for (let i = 1; i <= count; i += 1) {
    const t = i / count;
    points.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
  }
  return points;
}

export interface TapOptions {
  /** Finger wobble in px, must stay under the coarse tap slop to count as a tap. */
  readonly slopPx?: number;
  /** Finger-down duration in ms. Default 60. */
  readonly durationMs?: number;
}

export function planTap(centre: Point, options: TapOptions = {}): TouchStep[] {
  const durationMs = options.durationMs ?? 60;
  const slopPx = options.slopPx ?? 0;
  const steps: TouchStep[] = [{ type: 'touchStart', touchPoints: [finger(centre, 1)], atMs: 0 }];
  if (slopPx > 0) {
    steps.push({
      type: 'touchMove',
      touchPoints: [finger({ x: centre.x + slopPx, y: centre.y }, 1)],
      atMs: durationMs / 2,
    });
  }
  steps.push({ type: 'touchEnd', touchPoints: [], atMs: durationMs });
  return steps;
}

export interface LongPressOptions {
  /** Hold duration in ms. Default: the long-press threshold plus 100. */
  readonly holdMs?: number;
}

export function planLongPress(centre: Point, options: LongPressOptions = {}): TouchStep[] {
  const holdMs = options.holdMs ?? THRESHOLDS.longPressMs + 100;
  return [
    { type: 'touchStart', touchPoints: [finger(centre, 1)], atMs: 0 },
    { type: 'touchEnd', touchPoints: [], atMs: holdMs },
  ];
}

export interface PanOptions {
  readonly dx: number;
  readonly dy: number;
  /** Total movement time in ms. Default 300. */
  readonly durationMs?: number;
  /** Number of `touchMove` events. Default 12. */
  readonly steps?: number;
  /** Hold still before moving, for press-and-hold-to-drag surfaces. Default 0. */
  readonly holdMs?: number;
}

export function planPan(centre: Point, options: PanOptions): TouchStep[] {
  const durationMs = options.durationMs ?? 300;
  const count = options.steps ?? 12;
  const holdMs = options.holdMs ?? 0;
  const end = { x: centre.x + options.dx, y: centre.y + options.dy };
  const steps: TouchStep[] = [{ type: 'touchStart', touchPoints: [finger(centre, 1)], atMs: 0 }];
  interpolate(centre, end, count).forEach((point, index) => {
    steps.push({
      type: 'touchMove',
      touchPoints: [finger(point, 1)],
      atMs: holdMs + (durationMs * (index + 1)) / count,
    });
  });
  steps.push({ type: 'touchEnd', touchPoints: [], atMs: holdMs + durationMs });
  return steps;
}

export interface SwipeOptions {
  readonly direction: Direction;
  /** Travel in px. Default 120. */
  readonly distancePx?: number;
  /** Fast by default (200 ms) so velocity-based recognisers read a fling. */
  readonly durationMs?: number;
  readonly steps?: number;
}

const VECTORS: Readonly<Record<Direction, Point>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function planSwipe(centre: Point, options: SwipeOptions): TouchStep[] {
  const distance = options.distancePx ?? 120;
  const vector = VECTORS[options.direction];
  return planPan(centre, {
    dx: vector.x * distance,
    dy: vector.y * distance,
    durationMs: options.durationMs ?? 200,
    steps: options.steps ?? 8,
  });
}

export interface PinchOptions {
  /** Final distance between fingers divided by the initial one; < 1 pinches in. Default 2. */
  readonly scale?: number;
  /** Initial gap between the two fingers in px. Default 80. */
  readonly startDistancePx?: number;
  readonly durationMs?: number;
  readonly steps?: number;
}

export function planPinch(centre: Point, options: PinchOptions = {}): TouchStep[] {
  const scale = options.scale ?? 2;
  if (scale <= 0) throw new Error(`pinch scale must be positive, got ${scale}`);
  const half = (options.startDistancePx ?? 80) / 2;
  const durationMs = options.durationMs ?? 300;
  const count = options.steps ?? 12;
  const a0 = { x: centre.x - half, y: centre.y };
  const b0 = { x: centre.x + half, y: centre.y };
  const a1 = { x: centre.x - half * scale, y: centre.y };
  const b1 = { x: centre.x + half * scale, y: centre.y };
  const steps: TouchStep[] = [
    { type: 'touchStart', touchPoints: [finger(a0, 1)], atMs: 0 },
    { type: 'touchStart', touchPoints: [finger(a0, 1), finger(b0, 2)], atMs: 16 },
  ];
  const pathA = interpolate(a0, a1, count);
  const pathB = interpolate(b0, b1, count);
  for (let i = 0; i < count; i += 1) {
    const pa = pathA[i];
    const pb = pathB[i];
    if (!pa || !pb) break;
    steps.push({
      type: 'touchMove',
      touchPoints: [finger(pa, 1), finger(pb, 2)],
      atMs: 16 + (durationMs * (i + 1)) / count,
    });
  }
  steps.push({ type: 'touchEnd', touchPoints: [finger(a1, 1)], atMs: 16 + durationMs });
  steps.push({ type: 'touchEnd', touchPoints: [], atMs: 32 + durationMs });
  return steps;
}

/** Dispatch planned steps over CDP with the planned pauses between them. */
export async function dispatchTouch(page: Page, steps: readonly TouchStep[]): Promise<void> {
  const session = await cdpSession(page, 'touch');
  let elapsed = 0;
  for (const step of steps) {
    await sleep(step.atMs - elapsed);
    elapsed = step.atMs;
    await session.send('Input.dispatchTouchEvent', {
      type: step.type,
      touchPoints: step.touchPoints.map((point) => ({ ...point })),
    });
  }
}

export async function tap(page: Page, target: Target, options: TapOptions = {}): Promise<void> {
  await dispatchTouch(page, planTap(await centreOf(target), options));
}

export async function longPress(
  page: Page,
  target: Target,
  options: LongPressOptions = {},
): Promise<void> {
  await dispatchTouch(page, planLongPress(await centreOf(target), options));
}

export async function pan(page: Page, target: Target, options: PanOptions): Promise<void> {
  await dispatchTouch(page, planPan(await centreOf(target), options));
}

export async function swipe(page: Page, target: Target, options: SwipeOptions): Promise<void> {
  await dispatchTouch(page, planSwipe(await centreOf(target), options));
}

export async function pinch(page: Page, target: Target, options: PinchOptions = {}): Promise<void> {
  await dispatchTouch(page, planPinch(await centreOf(target), options));
}
