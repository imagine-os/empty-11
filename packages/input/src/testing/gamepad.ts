import type { Page } from '@playwright/test';
import { type GamepadButton, STANDARD_BUTTON_MAP } from '../contract/gamepad.js';
import { sleep } from './errors.js';

/**
 * A `navigator.getGamepads()` mock the page polls like a real pad.
 *
 * The Gamepad API is a polled snapshot, so the mock is a state machine the
 * test drives (`press`, `stick`, `connect`, `disconnect`) and the page reads
 * on its next `requestAnimationFrame`. Button names come from the contract's
 * standard mapping (`a`, `b`, `up`, `start`, …), never from indices.
 */

/** What the mock keeps per button, matching `GamepadButton` in the DOM API. */
export interface MockButtonState {
  pressed: boolean;
  touched: boolean;
  value: number;
}

export interface MockGamepadSnapshot {
  readonly connected: boolean;
  readonly id: string;
  readonly index: number;
  readonly mapping: 'standard' | '';
  readonly timestamp: number;
  readonly buttons: readonly MockButtonState[];
  readonly axes: readonly number[];
}

export interface ConnectOptions {
  /** Device id; put "remote" in it to be classified as a TV remote. */
  readonly id?: string;
  readonly index?: number;
  readonly mapping?: 'standard' | '';
  /** Number of axes; a remote has none. Default 4. */
  readonly axes?: number;
}

/** The in-page controller the mock installs at `window.__paperosGamepad`. */
export interface GamepadMockController {
  connect(options?: ConnectOptions): MockGamepadSnapshot;
  disconnect(): void;
  setButton(name: string, pressed: boolean, value?: number): void;
  setStick(side: 'left' | 'right', x: number, y: number): void;
  snapshot(): MockGamepadSnapshot;
}

export interface InstallGamepadMockOptions {
  /** Button names in standard-mapping order; the page gets `STANDARD_BUTTON_MAP`. */
  readonly buttons: readonly string[];
  /** Window to install on; defaults to `globalThis` (the page). Unit tests pass a stub. */
  readonly win?: object;
}

/**
 * Install the mock. **Self-contained on purpose**: Playwright serialises this
 * function's source into the page, so it may not reference anything outside
 * its own body. The same function runs unchanged under jsdom in the unit test.
 */
export function installGamepadMock(options: InstallGamepadMockOptions): GamepadMockController {
  const win = (options.win ?? globalThis) as {
    navigator: Navigator;
    dispatchEvent?: (event: Event) => boolean;
    __paperosGamepad?: GamepadMockController;
  };
  const names = [...options.buttons];
  let clock = 0;
  const now = () => {
    clock += 1;
    return clock;
  };

  const blank = (): MockButtonState => ({ pressed: false, touched: false, value: 0 });
  let state: {
    connected: boolean;
    id: string;
    index: number;
    mapping: 'standard' | '';
    timestamp: number;
    buttons: MockButtonState[];
    axes: number[];
  } = {
    connected: false,
    id: 'PaperOS Mock Gamepad (STANDARD GAMEPAD)',
    index: 0,
    mapping: 'standard',
    timestamp: 0,
    buttons: names.map(blank),
    axes: [0, 0, 0, 0],
  };

  const snapshot = (): MockGamepadSnapshot => ({
    connected: state.connected,
    id: state.id,
    index: state.index,
    mapping: state.mapping,
    timestamp: state.timestamp,
    buttons: state.buttons.map((button) => ({ ...button })),
    axes: [...state.axes],
  });

  const emit = (type: 'gamepadconnected' | 'gamepaddisconnected') => {
    if (typeof Event !== 'function' || typeof win.dispatchEvent !== 'function') return;
    const event = new Event(type);
    Object.defineProperty(event, 'gamepad', { value: snapshot(), enumerable: true });
    win.dispatchEvent(event);
  };

  const controller: GamepadMockController = {
    connect(connectOptions = {}) {
      state = {
        connected: true,
        id: connectOptions.id ?? state.id,
        index: connectOptions.index ?? 0,
        mapping: connectOptions.mapping ?? 'standard',
        timestamp: now(),
        buttons: names.map(blank),
        axes: new Array<number>(connectOptions.axes ?? 4).fill(0),
      };
      emit('gamepadconnected');
      return snapshot();
    },
    disconnect() {
      if (!state.connected) return;
      state = { ...state, connected: false, timestamp: now() };
      emit('gamepaddisconnected');
    },
    setButton(name, pressed, value) {
      const index = names.indexOf(name);
      if (index < 0) throw new Error(`Unknown gamepad button ${JSON.stringify(name)}`);
      const button = state.buttons[index];
      if (!button) throw new Error(`Gamepad button ${name} has no slot`);
      button.pressed = pressed;
      button.touched = pressed;
      button.value = value ?? (pressed ? 1 : 0);
      state.timestamp = now();
    },
    setStick(side, x, y) {
      const offset = side === 'left' ? 0 : 2;
      if (state.axes.length < offset + 2) {
        throw new Error(`This pad has ${state.axes.length} axes and no ${side} stick`);
      }
      state.axes[offset] = Math.max(-1, Math.min(1, x));
      state.axes[offset + 1] = Math.max(-1, Math.min(1, y));
      state.timestamp = now();
    },
    snapshot,
  };

  const getGamepads = () => {
    const pads: (MockGamepadSnapshot | null)[] = [null, null, null, null];
    if (state.connected) pads[state.index] = snapshot();
    return pads;
  };
  Object.defineProperty(win.navigator, 'getGamepads', {
    configurable: true,
    writable: true,
    value: getGamepads,
  });
  win.__paperosGamepad = controller;
  return controller;
}

export interface PressOptions {
  /** How long the button stays down, in ms. Default 60. */
  readonly holdMs?: number;
}

/** The test-side handle returned by `gamepad(page)`. */
export interface GamepadMock {
  connect(options?: ConnectOptions): Promise<MockGamepadSnapshot>;
  disconnect(): Promise<void>;
  /** Press and release, holding for `holdMs`. */
  press(button: GamepadButton, options?: PressOptions): Promise<void>;
  hold(button: GamepadButton, value?: number): Promise<void>;
  release(button: GamepadButton): Promise<void>;
  /** Push a stick to `(x, y)` in [-1, 1]; `(0, 0)` recentres it. */
  stick(side: 'left' | 'right', x: number, y: number): Promise<void>;
  state(): Promise<MockGamepadSnapshot>;
}

const INSTALL_ARG = { buttons: STANDARD_BUTTON_MAP };

/** One instruction for the in-page controller; serialisable, so no closures. */
export type GamepadCommand =
  | { readonly op: 'connect'; readonly options: ConnectOptions }
  | { readonly op: 'disconnect' }
  | {
      readonly op: 'button';
      readonly name: string;
      readonly pressed: boolean;
      readonly value?: number;
    }
  | {
      readonly op: 'stick';
      readonly side: 'left' | 'right';
      readonly x: number;
      readonly y: number;
    }
  | { readonly op: 'snapshot' };

/** Runs in the page: apply one command to the installed controller. Self-contained. */
export function runGamepadCommand(command: GamepadCommand): MockGamepadSnapshot {
  const controller = (globalThis as { __paperosGamepad?: GamepadMockController }).__paperosGamepad;
  if (!controller)
    throw new Error('Gamepad mock is not installed on this page; call gamepad(page) first');
  switch (command.op) {
    case 'connect':
      return controller.connect(command.options);
    case 'disconnect':
      controller.disconnect();
      break;
    case 'button':
      controller.setButton(command.name, command.pressed, command.value);
      break;
    case 'stick':
      controller.setStick(command.side, command.x, command.y);
      break;
    case 'snapshot':
      break;
  }
  return controller.snapshot();
}

/**
 * Install the mock in the page (and re-install it on every navigation) and
 * return a handle that drives it. `await (await input.gamepad()).connect()`
 * before pressing anything, as a real pad would connect first.
 */
export async function gamepad(page: Page): Promise<GamepadMock> {
  await page.addInitScript(installGamepadMock, INSTALL_ARG);
  await page.evaluate(installGamepadMock, INSTALL_ARG);
  const run = (command: GamepadCommand) => page.evaluate(runGamepadCommand, command);

  const mock: GamepadMock = {
    connect: (options = {}) => run({ op: 'connect', options }),
    async disconnect() {
      await run({ op: 'disconnect' });
    },
    async hold(button, value) {
      await run(
        value === undefined
          ? { op: 'button', name: button, pressed: true }
          : { op: 'button', name: button, pressed: true, value },
      );
    },
    async release(button) {
      await run({ op: 'button', name: button, pressed: false });
    },
    async press(button, options = {}) {
      await mock.hold(button);
      await sleep(options.holdMs ?? 60);
      await mock.release(button);
    },
    async stick(side, x, y) {
      await run({ op: 'stick', side, x, y });
    },
    state: () => run({ op: 'snapshot' }),
  };
  return mock;
}
