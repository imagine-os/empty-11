/**
 * Optional React bindings.
 *
 * The core of `@paperos/input` is framework-free; this file is the only place
 * React appears, and `react` is an optional peer dependency. A consumer that is
 * not React (a web component, a Tauri sidecar, a test) imports
 * `@paperos/input` and never loads this module.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { InputEvent } from '../contract/event.js';
import type { InputCapabilities, ModalityState } from '../contract/modality.js';
import type { Direction, InputModality } from '../contract/primitives.js';
import type { FocusCandidate, SpatialNavigator, SpatialOptions } from '../focus/index.js';
import { createSpatialNavigator } from '../focus/index.js';
import type { ModalityDetector, ModalityEnvironment } from '../modality/index.js';
import { createModalityDetector } from '../modality/index.js';

/**
 * One detector per document. Modality is a property of the person at the
 * keyboard, not of a component, so every hook shares this instance.
 */
let sharedDetector: ModalityDetector | null = null;

export function getModalityDetector(environment?: ModalityEnvironment): ModalityDetector {
  if (sharedDetector === null) {
    sharedDetector =
      environment === undefined && typeof window !== 'undefined'
        ? createModalityDetector({
            matchMedia: (query) => window.matchMedia(query),
            navigator: window.navigator,
            documentElement: window.document.documentElement,
            now: () => performance.now(),
            speechSupported: 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window,
          })
        : createModalityDetector(environment ?? {});
  }
  return sharedDetector;
}

/** Test seam: drop the shared detector so the next call rebuilds it. */
export function resetModalityDetector(): void {
  sharedDetector = null;
}

/** Subscribe to the whole modality state. */
export function useModalityState(
  detector: ModalityDetector = getModalityDetector(),
): ModalityState {
  return useSyncExternalStore(
    useCallback((listener) => detector.subscribe(listener), [detector]),
    useCallback(() => detector.getState(), [detector]),
    useCallback(() => detector.getState(), [detector]),
  );
}

/**
 * The stickier answer: what the person is using. Focus rings (PAP-152) and hit
 * targets (PAP-236) read this, not `current`.
 */
export function useLastInputModality(detector?: ModalityDetector): InputModality {
  return useModalityState(detector).preferred;
}

/** What the device can do. */
export function useInputCapabilities(detector?: ModalityDetector): InputCapabilities {
  return useModalityState(detector).capabilities;
}

/**
 * Mirror `data-input-*` onto `<html>` and keep it current. Mount once, near the
 * app root; CSS then styles by modality with no JavaScript in the render path.
 */
export function useInputDataAttributes(detector: ModalityDetector = getModalityDetector()): void {
  useEffect(() => {
    detector.syncAttributes();
    return detector.subscribe(() => detector.syncAttributes());
  }, [detector]);
}

/** Feed events from anywhere into the shared detector. */
export function useInputObserver(
  detector: ModalityDetector = getModalityDetector(),
): (event: InputEvent) => void {
  return useCallback(
    (event: InputEvent) => {
      detector.observe(event);
    },
    [detector],
  );
}

/**
 * Spatial focus navigation bound to a React tree. `getCandidates` is re-read on
 * every move, so a virtualised list needs no invalidation.
 */
export function useSpatialNavigation<T>(
  getCandidates: () => readonly FocusCandidate<T>[],
  options: SpatialOptions = {},
): { move(direction: Direction): T | null; focus(target: T | null): void; current: T | null } {
  // Both inputs are read through refs, because a call site almost always
  // passes a fresh closure and a fresh options literal on every render; the
  // navigator itself must survive those renders or it forgets where focus is.
  const latest = useRef(getCandidates);
  latest.current = getCandidates;
  const latestOptions = useRef(options);
  latestOptions.current = options;

  const navigatorRef = useRef<SpatialNavigator<T> | null>(null);
  navigatorRef.current ??= createSpatialNavigator<T>(
    () => latest.current(),
    () => latestOptions.current,
  );
  const navigator = navigatorRef.current;
  const [current, setCurrent] = useState<T | null>(null);

  const move = useCallback(
    (direction: Direction) => {
      const next = navigator.move(direction);
      setCurrent(next);
      return next;
    },
    [navigator],
  );

  const focus = useCallback(
    (target: T | null) => {
      navigator.focus(target);
      setCurrent(target);
    },
    [navigator],
  );

  return { move, focus, current };
}
