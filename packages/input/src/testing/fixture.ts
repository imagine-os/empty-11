import { test as base, type Locator, type Page } from '@playwright/test';
import type { GamepadButton } from '../contract/gamepad.js';
import { cdpAvailable, type Target } from './cdp.js';
import {
  type ChordOptions,
  holdKey,
  pressChord,
  type SequenceOptions,
  sequence,
} from './chords.js';
import {
  type DragPointerOptions,
  dragKeyboard,
  dragPointer,
  type KeyboardDragMove,
  type KeyboardDragOptions,
} from './drag.js';
import { CdpUnavailableError } from './errors.js';
import { type GamepadMock, gamepad } from './gamepad.js';
import {
  type AnnouncementOptions,
  type ExpectedModality,
  expectAnnouncement,
  expectModality,
  expectTouchTargets,
  type ModalityOptions,
  type TouchTargetOptions,
  type TouchTargetReport,
  touchTargets,
} from './modality.js';
import { type PenOptions, type PenPoint, type PenStroke, pen, penTap } from './pen.js';
import {
  type LongPressOptions,
  longPress,
  type PanOptions,
  type PinchOptions,
  pan,
  pinch,
  type SwipeOptions,
  swipe,
  type TapOptions,
  tap,
} from './touch.js';

/**
 * The `input` fixture: every helper bound to the test's page, with the
 * CDP-only helpers (touch, pen) turned into an explicit **skip** on Firefox
 * and WebKit so a suite stays green there without pretending the gesture
 * ran. Standalone functions (`tap(page, …)`) throw `CdpUnavailableError`
 * instead, for callers outside a test body.
 */
export interface InputFixture {
  /** True on Chromium; touch and pen helpers need it. */
  readonly cdpAvailable: boolean;
  pressChord(chord: string, options?: ChordOptions): Promise<void>;
  sequence(chords: string, options?: SequenceOptions): Promise<void>;
  holdKey(chord: string, ms: number, options?: ChordOptions): Promise<void>;
  tap(target: Target, options?: TapOptions): Promise<void>;
  longPress(target: Target, options?: LongPressOptions): Promise<void>;
  swipe(target: Target, options: SwipeOptions): Promise<void>;
  pinch(target: Target, options?: PinchOptions): Promise<void>;
  pan(target: Target, options: PanOptions): Promise<void>;
  pen(target: Target, strokes: readonly PenStroke[], options?: PenOptions): Promise<void>;
  penTap(target: Target, point: PenPoint, options?: PenOptions): Promise<void>;
  gamepad(): Promise<GamepadMock>;
  dragKeyboard(
    handle: Locator,
    moves: string | readonly KeyboardDragMove[],
    options?: KeyboardDragOptions,
  ): Promise<void>;
  dragPointer(from: Target, to: Target, options?: DragPointerOptions): Promise<void>;
  expectModality(expected: ExpectedModality, options?: ModalityOptions): Promise<void>;
  expectAnnouncement(matcher: string | RegExp, options?: AnnouncementOptions): Promise<void>;
  touchTargets(options?: TouchTargetOptions): Promise<TouchTargetReport>;
  expectTouchTargets(options?: TouchTargetOptions): Promise<TouchTargetReport>;
}

export interface CreateInputOptions {
  readonly browserName: string;
  /** Called instead of throwing when a helper needs CDP the browser lacks. */
  readonly skip?: (message: string) => void;
}

/** Bind every helper to one page. Used by the fixture; usable on its own. */
export function createInput(page: Page, options: CreateInputOptions): InputFixture {
  const hasCdp = cdpAvailable(page);
  const gate = <A extends unknown[], R>(
    helper: string,
    fn: (page: Page, ...args: A) => Promise<R>,
  ) => {
    return async (...args: A): Promise<R> => {
      if (!hasCdp) {
        const error = new CdpUnavailableError(helper, options.browserName);
        options.skip?.(error.message);
        throw error;
      }
      return fn(page, ...args);
    };
  };

  return {
    cdpAvailable: hasCdp,
    pressChord: (chord, o) => pressChord(page, chord, o),
    sequence: (chords, o) => sequence(page, chords, o),
    holdKey: (chord, ms, o) => holdKey(page, chord, ms, o),
    tap: gate('tap', tap),
    longPress: gate('longPress', longPress),
    swipe: gate('swipe', swipe),
    pinch: gate('pinch', pinch),
    pan: gate('pan', pan),
    pen: gate('pen', pen),
    penTap: gate('penTap', penTap),
    gamepad: () => gamepad(page),
    dragKeyboard: (handle, moves, o) => dragKeyboard(page, handle, moves, o),
    dragPointer: (from, to, o) => dragPointer(page, from, to, o),
    expectModality: (expected, o) => expectModality(page, expected, o),
    expectAnnouncement: (matcher, o) => expectAnnouncement(page, matcher, o),
    touchTargets: (o) => touchTargets(page, o),
    expectTouchTargets: (o) => expectTouchTargets(page, o),
  };
}

/**
 * `import { test, expect } from '@paperos/input/testing'` and every test gets
 * `input`. Extend further with `test.extend({ … })` as usual.
 */
export const test = base.extend<{ input: InputFixture }>({
  input: async ({ page, browserName }, use) => {
    await use(
      createInput(page, {
        browserName,
        skip: (message) => base.skip(true, message),
      }),
    );
  },
});

export { expect } from '@playwright/test';
export type { GamepadButton, GamepadMock, Locator, Page, Target };
