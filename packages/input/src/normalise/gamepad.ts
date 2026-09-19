import type { GamepadInputEvent } from '../contract/event.js';
import type {
  FocusNavigation,
  GamepadAxes,
  GamepadButton,
  GamepadDevice,
} from '../contract/gamepad.js';
import { STANDARD_BUTTON_MAP } from '../contract/gamepad.js';
import type { Direction } from '../contract/primitives.js';
import { NO_MODIFIERS } from '../contract/primitives.js';
import { INPUT_CONTRACT_VERSION } from '../contract/version.js';
import { THRESHOLDS } from '../thresholds.js';
import type { GamepadLike, NormaliseOptions } from './dom.js';
import { newEventId } from './ids.js';

/**
 * Gamepad API → `gamepad` events.
 *
 * The Gamepad API has no events, only a polled snapshot, so this module is a
 * differ: feed it successive snapshots (from `requestAnimationFrame`) and it
 * emits presses, auto-repeats and releases. D-pad presses and the left stick
 * past its deadzone both come out as `navigation`, so a TV remote with four
 * keys and a controller with two sticks drive focus identically.
 */

const DPAD: Readonly<Record<string, Direction>> = {
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
};

/** Device ids that mean "this is a TV remote, not a game controller". */
const REMOTE_HINTS = [/remote/i, /tv/i, /android.?tv/i, /webos/i, /tizen/i, /bravia/i];

export function roleOf(gamepad: GamepadLike): GamepadDevice['role'] {
  if (REMOTE_HINTS.some((hint) => hint.test(gamepad.id))) return 'remote';
  // A pad with no sticks (or only a d-pad worth of buttons) is a remote.
  return gamepad.axes.length < 2 ? 'remote' : 'gamepad';
}

export function deviceOf(gamepad: GamepadLike): GamepadDevice {
  return {
    index: gamepad.index,
    id: gamepad.id,
    mapping: gamepad.mapping === 'standard' ? 'standard' : 'non-standard',
    role: roleOf(gamepad),
  };
}

/** Apply the deadzone and rescale so the usable range is still [0, 1]. */
export function applyDeadzone(
  value: number,
  deadzone: number = THRESHOLDS.gamepadDeadzone,
): number {
  const magnitude = Math.abs(value);
  if (magnitude <= deadzone) return 0;
  const scaled = (magnitude - deadzone) / (1 - deadzone);
  return Math.sign(value) * Math.min(1, scaled);
}

export function axesOf(
  gamepad: GamepadLike,
  deadzone: number = THRESHOLDS.gamepadDeadzone,
): GamepadAxes {
  return {
    leftX: applyDeadzone(gamepad.axes[0] ?? 0, deadzone),
    leftY: applyDeadzone(gamepad.axes[1] ?? 0, deadzone),
    rightX: applyDeadzone(gamepad.axes[2] ?? 0, deadzone),
    rightY: applyDeadzone(gamepad.axes[3] ?? 0, deadzone),
  };
}

/** The direction a stick is pushed, or null inside the deadzone. */
export function stickDirection(x: number, y: number): Direction | null {
  if (x === 0 && y === 0) return null;
  return Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : y > 0 ? 'down' : 'up';
}

/** One control's state between two polls. */
interface ButtonState {
  pressed: boolean;
  /** Timestamp of the press, used for the repeat delay. */
  pressedAt: number;
  /** Timestamp of the last emitted repeat. */
  repeatedAt: number;
}

export interface GamepadDifferOptions extends NormaliseOptions {
  readonly deadzone?: number;
  readonly repeatDelayMs?: number;
  readonly repeatIntervalMs?: number;
  /** `focus` moves the focus ring; `cursor` drives the synthetic pointer. */
  readonly navigationMode?: FocusNavigation['mode'];
}

export interface GamepadDiffer {
  /** Diff one snapshot against the last and return the events it implies. */
  poll(gamepads: readonly (GamepadLike | null)[], timeStamp: number): GamepadInputEvent[];
  reset(): void;
}

/**
 * Create the poller-side differ.
 *
 * Held directions auto-repeat: one event after `repeatDelayMs`, then one every
 * `repeatIntervalMs`, with `phase: 'repeat'` so a dialog can ignore them while
 * a long list scrolls.
 */
export function createGamepadDiffer(options: GamepadDifferOptions = {}): GamepadDiffer {
  const deadzone = options.deadzone ?? THRESHOLDS.gamepadDeadzone;
  const repeatDelay = options.repeatDelayMs ?? THRESHOLDS.gamepadRepeatDelayMs;
  const repeatInterval = options.repeatIntervalMs ?? THRESHOLDS.gamepadRepeatIntervalMs;
  const mode = options.navigationMode ?? 'focus';
  const newId = options.newId ?? newEventId;
  const states = new Map<string, ButtonState>();

  const emit = (
    device: GamepadDevice,
    button: GamepadButton,
    phase: GamepadInputEvent['phase'],
    value: number,
    axes: GamepadAxes,
    timeStamp: number,
  ): GamepadInputEvent => {
    const direction = DPAD[button];
    const navigation: FocusNavigation | null =
      direction !== undefined && phase !== 'release'
        ? { direction, repeat: phase === 'repeat', mode }
        : null;
    return {
      id: newId(),
      contract: INPUT_CONTRACT_VERSION,
      timeStamp,
      modality: device.role,
      modifiers: { ...NO_MODIFIERS },
      surfaceId: options.surfaceId ?? null,
      kind: 'gamepad',
      device,
      phase,
      button,
      value: Math.min(1, Math.max(0, value)),
      axes,
      navigation,
    };
  };

  /** Fold one control's new state into the map and emit what it implies. */
  const step = (
    key: string,
    device: GamepadDevice,
    button: GamepadButton,
    pressed: boolean,
    value: number,
    axes: GamepadAxes,
    timeStamp: number,
    out: GamepadInputEvent[],
  ): void => {
    const previous = states.get(key);
    if (pressed && previous === undefined) {
      states.set(key, { pressed: true, pressedAt: timeStamp, repeatedAt: timeStamp });
      out.push(emit(device, button, 'press', value, axes, timeStamp));
      return;
    }
    if (pressed && previous !== undefined) {
      const heldFor = timeStamp - previous.pressedAt;
      const sinceRepeat = timeStamp - previous.repeatedAt;
      const due = heldFor >= repeatDelay && sinceRepeat >= repeatInterval;
      if (due) {
        previous.repeatedAt = timeStamp;
        out.push(emit(device, button, 'repeat', value, axes, timeStamp));
      }
      return;
    }
    if (!pressed && previous !== undefined) {
      states.delete(key);
      out.push(emit(device, button, 'release', value, axes, timeStamp));
    }
  };

  return {
    poll(gamepads, timeStamp) {
      const out: GamepadInputEvent[] = [];
      for (const gamepad of gamepads) {
        if (gamepad === null || !gamepad.connected) continue;
        const device = deviceOf(gamepad);
        const axes = axesOf(gamepad, deadzone);

        gamepad.buttons.forEach((raw, index) => {
          const button = STANDARD_BUTTON_MAP[index];
          if (button === undefined) return;
          step(
            `${gamepad.index}:${button}`,
            device,
            button,
            raw.pressed,
            raw.value,
            axes,
            timeStamp,
            out,
          );
        });

        // The left stick doubles as a d-pad so a controller without one still
        // navigates; it is keyed separately so both can be held at once.
        const direction = stickDirection(axes.leftX, axes.leftY);
        for (const candidate of ['up', 'down', 'left', 'right'] as const) {
          step(
            `${gamepad.index}:stick:${candidate}`,
            device,
            candidate,
            direction === candidate,
            direction === candidate ? 1 : 0,
            axes,
            timeStamp,
            out,
          );
        }
      }
      return out;
    },
    reset() {
      states.clear();
    },
  };
}
