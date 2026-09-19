import type { InputEvent } from '../contract/event.js';
import type { InputCapabilities, ModalityState } from '../contract/modality.js';
import { DATA_ATTRIBUTES } from '../contract/modality.js';
import type { InputModality } from '../contract/primitives.js';

/**
 * Modality detection and the `preferredModality` signal.
 *
 * Two questions are answered here and they are not the same question:
 *
 * * *What can this device do?* — `capabilities`, from media queries plus what
 *   has been observed. Sticky: a tablet that has just been given a keyboard
 *   keeps its touch affordances.
 * * *What is the person using right now?* — `preferred`, which decides focus
 *   rings, hit-target sizes and whether a hover hint is worth showing.
 *
 * `preferred` is deliberately stickier than `current`: a mouse nudged while
 * someone is typing must not steal the focus ring, and a scroll during
 * dictation must not turn the voice indicator off. Only a *deliberate*
 * interaction switches it.
 */

/** The DOM surface the detector needs. Injectable so it is testable headless. */
export interface ModalityEnvironment {
  matchMedia?(query: string): { matches: boolean };
  readonly navigator?: { maxTouchPoints?: number };
  readonly documentElement?: {
    setAttribute(name: string, value: string): void;
    removeAttribute(name: string): void;
  };
  readonly now?: () => number;
  readonly speechSupported?: boolean;
}

const DEFAULT_CAPABILITIES: InputCapabilities = {
  coarsePointer: false,
  finePointer: true,
  hover: true,
  touchPoints: 0,
  penSeen: false,
  keyboardSeen: false,
  gamepadConnected: false,
  remoteConnected: false,
  voiceSupported: false,
  reducedMotion: false,
};

/** Read what the platform will tell us without waiting for an event. */
export function queryCapabilities(environment: ModalityEnvironment = {}): InputCapabilities {
  const media = (query: string, fallback: boolean): boolean =>
    environment.matchMedia ? environment.matchMedia(query).matches : fallback;

  return {
    ...DEFAULT_CAPABILITIES,
    coarsePointer: media('(pointer: coarse)', false),
    finePointer: media('(any-pointer: fine)', true),
    hover: media('(any-hover: hover)', true),
    touchPoints: environment.navigator?.maxTouchPoints ?? 0,
    voiceSupported: environment.speechSupported ?? false,
    reducedMotion: media('(prefers-reduced-motion: reduce)', false),
  };
}

/**
 * Events that count as deliberate, per modality.
 *
 * A bare pointer `move` does not switch the preferred modality — that is the
 * stray-mouse-nudge case — but a press, a key, a d-pad press or a final voice
 * intent does.
 */
export function isDeliberate(event: InputEvent): boolean {
  switch (event.kind) {
    case 'press':
    case 'release':
      return true;
    case 'key':
      return event.phase === 'down' && !event.key.isComposing;
    case 'gamepad':
      return event.phase === 'press';
    case 'voice':
      return event.intent.final;
    case 'wheel':
      return true;
    default:
      return false;
  }
}

export type ModalityListener = (state: ModalityState) => void;

export interface ModalityDetector {
  /** Current snapshot. */
  getState(): ModalityState;
  /** Feed an event; returns the new state. */
  observe(event: InputEvent): ModalityState;
  /** Record a connected gamepad or remote. */
  setGamepadConnected(connected: boolean, role?: 'gamepad' | 'remote'): ModalityState;
  /** Re-read the media queries (call from a `change` listener). */
  refreshCapabilities(): ModalityState;
  /** Subscribe; returns the unsubscribe function. Fires on every change. */
  subscribe(listener: ModalityListener): () => void;
  /** Mirror the state onto `<html>` as `data-input-*` attributes. */
  syncAttributes(): void;
}

/**
 * Create the detector.
 *
 * Framework-free on purpose: `packages/input/react` wraps it in a hook, and a
 * plain script, a web component or a test can use it unchanged.
 */
export function createModalityDetector(environment: ModalityEnvironment = {}): ModalityDetector {
  const now = environment.now ?? (() => 0);
  let capabilities = queryCapabilities(environment);
  let state: ModalityState = {
    current: 'unknown',
    previous: 'unknown',
    preferred: capabilities.coarsePointer && !capabilities.finePointer ? 'touch' : 'mouse',
    changedAt: now(),
    capabilities,
  };
  const listeners = new Set<ModalityListener>();

  const publish = (next: ModalityState): ModalityState => {
    state = next;
    for (const listener of listeners) listener(state);
    return state;
  };

  /** Capability flags only ever turn on: seeing a device is not reversible. */
  const observeCapabilities = (modality: InputModality): InputCapabilities => {
    const next = { ...capabilities };
    if (modality === 'pen') next.penSeen = true;
    if (modality === 'keyboard') next.keyboardSeen = true;
    if (modality === 'touch') next.coarsePointer = true;
    if (modality === 'mouse') next.finePointer = true;
    if (modality === 'gamepad') next.gamepadConnected = true;
    if (modality === 'remote') next.remoteConnected = true;
    capabilities = next;
    return next;
  };

  const detector: ModalityDetector = {
    getState: () => state,

    observe(event) {
      const modality = event.modality;
      const nextCapabilities = observeCapabilities(modality);
      const switches =
        isDeliberate(event) && modality !== 'unknown' && modality !== state.preferred;
      return publish({
        current: modality,
        previous: state.current,
        preferred: switches ? modality : state.preferred,
        changedAt: switches ? event.timeStamp : state.changedAt,
        capabilities: nextCapabilities,
      });
    },

    setGamepadConnected(connected, role = 'gamepad') {
      capabilities = {
        ...capabilities,
        gamepadConnected: role === 'gamepad' ? connected : capabilities.gamepadConnected,
        remoteConnected: role === 'remote' ? connected : capabilities.remoteConnected,
      };
      return publish({ ...state, capabilities });
    },

    refreshCapabilities() {
      const queried = queryCapabilities(environment);
      capabilities = {
        ...queried,
        // Observed flags survive a media-query refresh.
        penSeen: capabilities.penSeen,
        keyboardSeen: capabilities.keyboardSeen,
        gamepadConnected: capabilities.gamepadConnected,
        remoteConnected: capabilities.remoteConnected,
        coarsePointer: queried.coarsePointer || capabilities.coarsePointer,
        finePointer: queried.finePointer || capabilities.finePointer,
      };
      return publish({ ...state, capabilities });
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    syncAttributes() {
      const root = environment.documentElement;
      if (!root) return;
      root.setAttribute(DATA_ATTRIBUTES.modality, state.current);
      root.setAttribute(DATA_ATTRIBUTES.preferred, state.preferred);
      const flags: [string, boolean][] = [
        [DATA_ATTRIBUTES.coarse, state.capabilities.coarsePointer],
        [DATA_ATTRIBUTES.fine, state.capabilities.finePointer],
        [DATA_ATTRIBUTES.hover, state.capabilities.hover],
        [DATA_ATTRIBUTES.pen, state.capabilities.penSeen],
        [DATA_ATTRIBUTES.gamepad, state.capabilities.gamepadConnected],
        [DATA_ATTRIBUTES.remote, state.capabilities.remoteConnected],
      ];
      for (const [attribute, on] of flags) {
        if (on) root.setAttribute(attribute, '');
        else root.removeAttribute(attribute);
      }
    },
  };

  return detector;
}

/**
 * The `preferredModality` signal on its own, for consumers that want a value
 * and a subscription and nothing else (CSS-in-JS, a web component, a store).
 */
export interface PreferredModalitySignal {
  get(): InputModality;
  subscribe(listener: (modality: InputModality) => void): () => void;
}

export function preferredModalitySignal(detector: ModalityDetector): PreferredModalitySignal {
  return {
    get: () => detector.getState().preferred,
    subscribe(listener) {
      let last = detector.getState().preferred;
      return detector.subscribe((state) => {
        if (state.preferred !== last) {
          last = state.preferred;
          listener(last);
        }
      });
    },
  };
}
