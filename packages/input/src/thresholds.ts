/**
 * Every timing and distance the input layer uses, in one table.
 *
 * They are exported constants rather than magic numbers in each recogniser so
 * gestures (PAP-154), drag-and-drop (PAP-155), pen (PAP-157) and gamepad
 * (PAP-158) agree, and so an accessibility preference (timing extensions, WCAG
 * 2.2.1) can scale them in one place.
 */
export const THRESHOLDS = {
  /** Movement allowed inside a tap, by pointer precision. */
  tapSlopPx: { fine: 8, coarse: 12 },
  /** Movement that promotes a press into a drag, by pointer precision. */
  dragStartPx: { fine: 4, coarse: 10 },
  /** Press duration that becomes a long press. */
  longPressMs: 500,
  /** Gap under which two presses are one double-press. */
  doublePressMs: 300,
  /**
   * After a pen event, touch presses on the same surface are ignored for this
   * long: the palm resting on a tablet must not draw.
   */
  penPalmRejectionMs: 300,
  /** Stick displacement below this is noise. */
  gamepadDeadzone: 0.25,
  /** Held d-pad: delay before auto-repeat, then the repeat interval. */
  gamepadRepeatDelayMs: 400,
  gamepadRepeatIntervalMs: 90,
  /** Pixels the synthetic gamepad cursor travels per second at full stick. */
  gamepadCursorSpeedPxPerSec: 900,
  /** Minimum interactive target, every modality, every breakpoint. */
  minTargetPx: 44,
  /** Delta magnitude below which a wheel burst is read as a trackpad. */
  trackpadDeltaPx: 40,
  /** One "line" of wheel delta, converting `deltaMode: line` to pixels. */
  wheelLineHeightPx: 16,
} as const;

export type Thresholds = typeof THRESHOLDS;

/** Pointer precision class used to pick a threshold. */
export type Precision = 'fine' | 'coarse';

/** The precision class a pointer kind implies. */
export function precisionOf(kind: 'mouse' | 'touch' | 'pen' | 'gamepad-cursor'): Precision {
  return kind === 'touch' || kind === 'gamepad-cursor' ? 'coarse' : 'fine';
}

/** Tap slop for a pointer kind. */
export function tapSlop(kind: 'mouse' | 'touch' | 'pen' | 'gamepad-cursor'): number {
  return THRESHOLDS.tapSlopPx[precisionOf(kind)];
}

/** Drag-start distance for a pointer kind. */
export function dragStart(kind: 'mouse' | 'touch' | 'pen' | 'gamepad-cursor'): number {
  return THRESHOLDS.dragStartPx[precisionOf(kind)];
}
