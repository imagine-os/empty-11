import type { Page } from '@playwright/test';
import { cdpSession, originOf, type Point, type Target } from './cdp.js';
import { sleep } from './errors.js';

/**
 * Pen strokes over CDP `Input.dispatchMouseEvent` with `pointerType: 'pen'`,
 * carrying pressure, tilt and twist so a drawing surface or a pressure-aware
 * control sees a real stylus. Chromium only (Firefox and WebKit have no CDP;
 * headless WebKit also ignores `pointerType: 'pen'`, see the docs page).
 */

export interface PenPoint {
  /** Relative to the target's top-left corner, in CSS px. */
  readonly x: number;
  readonly y: number;
  /** 0..1; defaults to the stroke pressure. */
  readonly pressure?: number;
  readonly tiltX?: number;
  readonly tiltY?: number;
  readonly twist?: number;
}

/** One pen-down → pen-up. A single point is a pen tap. */
export type PenStroke = readonly PenPoint[];

export interface PenOptions {
  /** Default pressure while the pen is down. Default 0.5. */
  readonly pressure?: number;
  /** Time per stroke in ms. Default 200. */
  readonly durationMs?: number;
  /** Lift time between strokes in ms. Default 40. */
  readonly gapMs?: number;
  /** Hover to the first point before pressing, as a real pen does. Default true. */
  readonly hoverFirst?: boolean;
}

export type PenStepType = 'mouseMoved' | 'mousePressed' | 'mouseReleased';

export interface PenStep {
  readonly type: PenStepType;
  readonly x: number;
  readonly y: number;
  readonly force: number;
  readonly tiltX: number;
  readonly tiltY: number;
  readonly twist: number;
  readonly atMs: number;
}

function step(
  type: PenStepType,
  origin: Point,
  point: PenPoint,
  force: number,
  atMs: number,
): PenStep {
  return {
    type,
    x: origin.x + point.x,
    y: origin.y + point.y,
    force,
    tiltX: point.tiltX ?? 0,
    tiltY: point.tiltY ?? 0,
    twist: point.twist ?? 0,
    atMs,
  };
}

/** Plan the CDP events for a set of strokes. Pure; unit tested. */
export function planPen(
  origin: Point,
  strokes: readonly PenStroke[],
  options: PenOptions = {},
): PenStep[] {
  const pressure = options.pressure ?? 0.5;
  const durationMs = options.durationMs ?? 200;
  const gapMs = options.gapMs ?? 40;
  const hoverFirst = options.hoverFirst ?? true;
  const steps: PenStep[] = [];
  let clock = 0;

  for (const stroke of strokes) {
    const first = stroke[0];
    if (!first) continue;
    if (hoverFirst) {
      steps.push(step('mouseMoved', origin, first, 0, clock));
      clock += 16;
    }
    steps.push(step('mousePressed', origin, first, first.pressure ?? pressure, clock));
    const segments = Math.max(1, stroke.length - 1);
    stroke.slice(1).forEach((point, index) => {
      steps.push(
        step(
          'mouseMoved',
          origin,
          point,
          point.pressure ?? pressure,
          clock + (durationMs * (index + 1)) / segments,
        ),
      );
    });
    const last = stroke[stroke.length - 1] ?? first;
    clock += stroke.length > 1 ? durationMs : 16;
    steps.push(step('mouseReleased', origin, last, 0, clock));
    clock += gapMs;
  }
  return steps;
}

/** Dispatch planned pen steps over CDP. */
export async function dispatchPen(page: Page, steps: readonly PenStep[]): Promise<void> {
  const session = await cdpSession(page, 'pen');
  let elapsed = 0;
  for (const current of steps) {
    await sleep(current.atMs - elapsed);
    elapsed = current.atMs;
    const down = current.type !== 'mouseMoved' || current.force > 0;
    await session.send('Input.dispatchMouseEvent', {
      type: current.type,
      x: current.x,
      y: current.y,
      pointerType: 'pen',
      button: current.type === 'mouseMoved' && !down ? 'none' : 'left',
      buttons: down ? 1 : 0,
      clickCount: current.type === 'mousePressed' ? 1 : 0,
      force: current.force,
      tiltX: current.tiltX,
      tiltY: current.tiltY,
      twist: current.twist,
    });
  }
}

/**
 * Draw strokes with a pen on a target. Points are relative to the target's
 * top-left corner, so `[[{ x: 10, y: 10 }, { x: 90, y: 60 }]]` is one
 * diagonal line across a 100×70 canvas.
 */
export async function pen(
  page: Page,
  target: Target,
  strokes: readonly PenStroke[],
  options: PenOptions = {},
): Promise<void> {
  await dispatchPen(page, planPen(await originOf(target), strokes, options));
}

/** A single pen-down/up at a relative point (or the target's centre offset you pass). */
export async function penTap(
  page: Page,
  target: Target,
  point: PenPoint,
  options: PenOptions = {},
): Promise<void> {
  await pen(page, target, [[point]], options);
}
