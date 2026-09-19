/**
 * The optional React bindings.
 *
 * Hooks only — no JSX, so this package needs no React transform and the core
 * stays framework-free. `renderHook` proves the `useSyncExternalStore` wiring,
 * which is the only part of the React layer that can be subtly wrong.
 */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { InputEvent } from '../contract/event.js';
import { DATA_ATTRIBUTES } from '../contract/modality.js';
import { INPUT_CONTRACT_VERSION } from '../contract/version.js';
import { createModalityDetector } from '../modality/index.js';
import {
  getModalityDetector,
  resetModalityDetector,
  useInputCapabilities,
  useInputDataAttributes,
  useLastInputModality,
  useSpatialNavigation,
} from './index.js';

afterEach(() => {
  cleanup();
  resetModalityDetector();
});

const keyDown: InputEvent = {
  id: 'r-1',
  contract: INPUT_CONTRACT_VERSION,
  timeStamp: 1,
  modality: 'keyboard',
  modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  surfaceId: null,
  kind: 'key',
  phase: 'down',
  key: { code: 'KeyA', key: 'a', repeat: false, isComposing: false, location: 0 },
  chord: 'a',
};

describe('useLastInputModality', () => {
  it('re-renders when the preferred modality changes', () => {
    const detector = createModalityDetector();
    const { result } = renderHook(() => useLastInputModality(detector));
    expect(result.current).toBe('mouse');
    act(() => {
      detector.observe(keyDown);
    });
    expect(result.current).toBe('keyboard');
  });
});

describe('useInputCapabilities', () => {
  it('exposes what the detector has observed', () => {
    const detector = createModalityDetector();
    const { result } = renderHook(() => useInputCapabilities(detector));
    expect(result.current.keyboardSeen).toBe(false);
    act(() => {
      detector.observe(keyDown);
    });
    expect(result.current.keyboardSeen).toBe(true);
  });
});

describe('useInputDataAttributes', () => {
  it('mirrors the modality onto <html> and keeps it current', () => {
    const detector = createModalityDetector({
      documentElement: document.documentElement,
      now: () => 0,
    });
    renderHook(() => {
      useInputDataAttributes(detector);
    });
    expect(document.documentElement.getAttribute(DATA_ATTRIBUTES.preferred)).toBe('mouse');
    act(() => {
      detector.observe(keyDown);
    });
    expect(document.documentElement.getAttribute(DATA_ATTRIBUTES.preferred)).toBe('keyboard');
  });
});

describe('getModalityDetector', () => {
  it('is one shared instance, because modality belongs to the person', () => {
    expect(getModalityDetector({})).toBe(getModalityDetector({}));
    const first = getModalityDetector({});
    resetModalityDetector();
    expect(getModalityDetector({})).not.toBe(first);
  });
});

describe('useSpatialNavigation', () => {
  it('moves focus by direction and reports the new target', () => {
    const cells = [
      { target: 'a', rect: { x: 0, y: 0, width: 100, height: 40 } },
      { target: 'b', rect: { x: 0, y: 60, width: 100, height: 40 } },
    ];
    const { result } = renderHook(() => useSpatialNavigation(() => cells));

    act(() => {
      result.current.focus('a');
    });
    expect(result.current.current).toBe('a');

    act(() => {
      result.current.move('down');
    });
    expect(result.current.current).toBe('b');

    act(() => {
      result.current.move('down');
    });
    expect(result.current.current).toBeNull();
  });
});
