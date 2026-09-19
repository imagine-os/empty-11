import { describe, expect, it } from 'vitest';
import { STANDARD_BUTTON_MAP } from '../contract/gamepad.js';
import { axesOf, deviceOf } from '../normalise/gamepad.js';
import { installGamepadMock, runGamepadCommand } from './gamepad.js';

function fakeWindow() {
  const listeners = new Map<string, ((event: Event) => void)[]>();
  const win = {
    navigator: {} as Navigator,
    dispatchEvent(event: Event) {
      for (const listener of listeners.get(event.type) ?? []) listener(event);
      return true;
    },
    on(type: string, listener: (event: Event) => void) {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
  };
  return win;
}

describe('installGamepadMock', () => {
  it('serves nothing until connected, then one pad at its index', () => {
    const win = fakeWindow();
    const controller = installGamepadMock({ buttons: STANDARD_BUTTON_MAP, win });
    expect(win.navigator.getGamepads().every((pad) => pad === null)).toBe(true);
    controller.connect({ index: 1, id: 'Test Pad' });
    const pads = win.navigator.getGamepads();
    expect(pads[0]).toBeNull();
    expect(pads[1]).toMatchObject({ connected: true, id: 'Test Pad', mapping: 'standard' });
  });

  it('presses by name in standard-mapping order and releases', () => {
    const win = fakeWindow();
    const controller = installGamepadMock({ buttons: STANDARD_BUTTON_MAP, win });
    controller.connect();
    controller.setButton('a', true);
    controller.setButton('down', true, 0.7);
    let snapshot = controller.snapshot();
    expect(snapshot.buttons[0]).toEqual({ pressed: true, touched: true, value: 1 });
    expect(snapshot.buttons[STANDARD_BUTTON_MAP.indexOf('down')]).toEqual({
      pressed: true,
      touched: true,
      value: 0.7,
    });
    controller.setButton('a', false);
    snapshot = controller.snapshot();
    expect(snapshot.buttons[0]?.pressed).toBe(false);
    expect(() => controller.setButton('turbo', true)).toThrow(/Unknown gamepad button/);
  });

  it('clamps sticks and advances the timestamp on every change', () => {
    const win = fakeWindow();
    const controller = installGamepadMock({ buttons: STANDARD_BUTTON_MAP, win });
    const before = controller.connect().timestamp;
    controller.setStick('left', 2, -0.5);
    controller.setStick('right', 0.25, 0.25);
    const snapshot = controller.snapshot();
    expect(snapshot.axes).toEqual([1, -0.5, 0.25, 0.25]);
    expect(snapshot.timestamp).toBeGreaterThan(before);
  });

  it('fires gamepadconnected and gamepaddisconnected with the pad attached', () => {
    const win = fakeWindow();
    const seen: string[] = [];
    win.on('gamepadconnected', (event) => {
      seen.push(`connected:${(event as Event & { gamepad: { id: string } }).gamepad.id}`);
    });
    win.on('gamepaddisconnected', () => seen.push('disconnected'));
    const controller = installGamepadMock({ buttons: STANDARD_BUTTON_MAP, win });
    controller.connect({ id: 'Living Room Remote' });
    controller.disconnect();
    controller.disconnect();
    expect(seen).toEqual(['connected:Living Room Remote', 'disconnected']);
  });

  it('is read by the runtime normaliser like a real pad', () => {
    const win = fakeWindow();
    const controller = installGamepadMock({ buttons: STANDARD_BUTTON_MAP, win });
    controller.connect({ id: 'Android TV Remote', axes: 0 });
    const pad = win.navigator.getGamepads()[0];
    if (!pad) throw new Error('pad missing');
    expect(deviceOf(pad).role).toBe('remote');
    controller.connect({ id: 'Xbox Wireless Controller (STANDARD GAMEPAD)' });
    controller.setStick('left', 0.6, 0);
    const xbox = win.navigator.getGamepads()[0];
    if (!xbox) throw new Error('pad missing');
    expect(deviceOf(xbox).role).toBe('gamepad');
    expect(axesOf(xbox).leftX).toBeGreaterThan(0);
  });

  it('runs serialisable commands against the installed controller', () => {
    installGamepadMock({ buttons: STANDARD_BUTTON_MAP });
    expect(runGamepadCommand({ op: 'connect', options: { id: 'Cmd Pad' } }).connected).toBe(true);
    runGamepadCommand({ op: 'button', name: 'start', pressed: true });
    expect(
      runGamepadCommand({ op: 'snapshot' }).buttons[STANDARD_BUTTON_MAP.indexOf('start')]?.pressed,
    ).toBe(true);
    runGamepadCommand({ op: 'stick', side: 'left', x: -1, y: 0 });
    expect(runGamepadCommand({ op: 'snapshot' }).axes[0]).toBe(-1);
    expect(runGamepadCommand({ op: 'disconnect' }).connected).toBe(false);
  });
});
