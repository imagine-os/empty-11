/**
 * Structural shapes of the DOM objects the normaliser reads.
 *
 * The normaliser is typed against these rather than against `lib.dom`'s classes
 * so it can be driven by a plain object in a test, by a real event in a
 * browser, and by a replayed golden fixture in CI — all without a cast. Real
 * DOM events satisfy them structurally.
 */

export interface PointerEventLike {
  readonly type: string;
  readonly pointerId: number;
  readonly pointerType: string;
  readonly isPrimary: boolean;
  readonly clientX: number;
  readonly clientY: number;
  readonly pageX: number;
  readonly pageY: number;
  readonly pressure: number;
  readonly tangentialPressure?: number;
  readonly tiltX?: number;
  readonly tiltY?: number;
  readonly twist?: number;
  readonly width?: number;
  readonly height?: number;
  readonly buttons: number;
  readonly button: number;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly timeStamp: number;
  getCoalescedEvents?(): readonly { clientX: number; clientY: number }[];
}

export interface KeyboardEventLike {
  readonly type: string;
  readonly code: string;
  readonly key: string;
  readonly repeat: boolean;
  readonly isComposing?: boolean;
  readonly keyCode?: number;
  readonly location?: number;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly timeStamp: number;
}

export interface WheelEventLike {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly deltaZ?: number;
  readonly deltaMode: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly pageX: number;
  readonly pageY: number;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly timeStamp: number;
}

/** `navigator.getGamepads()` entry. */
export interface GamepadLike {
  readonly index: number;
  readonly id: string;
  readonly mapping: string;
  readonly connected: boolean;
  readonly axes: readonly number[];
  readonly buttons: readonly { readonly pressed: boolean; readonly value: number }[];
}

/** The rectangle a pointer surface occupies, used for surface coordinates. */
export interface SurfaceRect {
  readonly left: number;
  readonly top: number;
}

/** Everything the normaliser needs besides the event itself. */
export interface NormaliseOptions {
  /** Id of the surface the event was delivered to. */
  readonly surfaceId?: string | null;
  /** Origin of the surface in client coordinates. Defaults to (0, 0). */
  readonly surfaceRect?: SurfaceRect | null;
  /** Chord platform; defaults to `other`. */
  readonly platform?: 'mac' | 'other';
  /** Injectable id factory so fixtures are deterministic. */
  readonly newId?: () => string;
  /** Viewport height, for converting `deltaMode: page` wheel deltas. */
  readonly viewportHeight?: number;
}
