import type { WheelInputEvent } from '../contract/event.js';
import { INPUT_CONTRACT_VERSION } from '../contract/version.js';
import { THRESHOLDS } from '../thresholds.js';
import type { NormaliseOptions, WheelEventLike } from './dom.js';
import { newEventId } from './ids.js';
import { modifiersOf } from './pointer.js';

/**
 * DOM WheelEvent → `wheel`, always in pixels.
 *
 * `deltaMode` is gone by the time a consumer sees the event: line mode is
 * multiplied by 16 px and page mode by the viewport height, so a Firefox wheel
 * and a Chrome wheel scroll the same distance. Pinch-zoom arrives as `ctrlKey`
 * with a wheel on every platform, which is why that flag is promoted to a
 * first-class field rather than left in `modifiers`.
 */

const DELTA_MODE_LINE = 1;
const DELTA_MODE_PAGE = 2;

/** Tracks recent deltas so a trackpad can be told from a notched wheel. */
export interface TrackpadDetector {
  /** Feed a raw delta; returns whether the current burst looks like a trackpad. */
  observe(deltaY: number, deltaX: number, timeStamp: number): boolean;
  reset(): void;
}

/**
 * Trackpad inference.
 *
 * A mouse wheel emits large, whole-number deltas at human cadence; a trackpad
 * emits small, often fractional deltas in fast bursts, and produces horizontal
 * deltas that a wheel almost never does. Any one signal is unreliable, so all
 * three are combined and the answer is sticky for the length of a burst.
 */
export function createTrackpadDetector(): TrackpadDetector {
  let lastTime = Number.NEGATIVE_INFINITY;
  let sticky = false;

  return {
    observe(deltaY, deltaX, timeStamp) {
      const burstContinues = timeStamp - lastTime < 120;
      lastTime = timeStamp;

      const fractional = !Number.isInteger(deltaY) || !Number.isInteger(deltaX);
      const small =
        Math.abs(deltaY) < THRESHOLDS.trackpadDeltaPx &&
        Math.abs(deltaX) < THRESHOLDS.trackpadDeltaPx;
      const horizontal = Math.abs(deltaX) > 0 && Math.abs(deltaX) >= Math.abs(deltaY);

      const looksLikeTrackpad = fractional || (small && (burstContinues || horizontal));
      sticky = burstContinues ? sticky || looksLikeTrackpad : looksLikeTrackpad;
      return sticky;
    },
    reset() {
      lastTime = Number.NEGATIVE_INFINITY;
      sticky = false;
    },
  };
}

/** Convert a raw delta in the event's delta mode to CSS pixels. */
export function toPixels(delta: number, deltaMode: number, viewportHeight: number): number {
  if (deltaMode === DELTA_MODE_LINE) return delta * THRESHOLDS.wheelLineHeightPx;
  if (deltaMode === DELTA_MODE_PAGE) return delta * viewportHeight;
  return delta;
}

export function normaliseWheelEvent(
  event: WheelEventLike,
  options: NormaliseOptions & { detector?: TrackpadDetector } = {},
): WheelInputEvent {
  const viewportHeight = options.viewportHeight ?? 800;
  const left = options.surfaceRect?.left ?? 0;
  const top = options.surfaceRect?.top ?? 0;

  const deltaX = toPixels(event.deltaX, event.deltaMode, viewportHeight);
  const deltaY = toPixels(event.deltaY, event.deltaMode, viewportHeight);
  const deltaZ = toPixels(event.deltaZ ?? 0, event.deltaMode, viewportHeight);

  const isTrackpad =
    options.detector?.observe(event.deltaY, event.deltaX, event.timeStamp) ??
    (!Number.isInteger(event.deltaY) || !Number.isInteger(event.deltaX));

  return {
    id: (options.newId ?? newEventId)(),
    contract: INPUT_CONTRACT_VERSION,
    timeStamp: event.timeStamp,
    modality: 'mouse',
    modifiers: modifiersOf(event),
    surfaceId: options.surfaceId ?? null,
    kind: 'wheel',
    deltaX,
    deltaY,
    deltaZ,
    deltaMode: 'pixel',
    isTrackpad,
    ctrlKey: event.ctrlKey,
    position: {
      client: { x: event.clientX, y: event.clientY },
      page: { x: event.pageX, y: event.pageY },
      surface: { x: event.clientX - left, y: event.clientY - top },
    },
  };
}
