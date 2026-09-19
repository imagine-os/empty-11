import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { InputEvent } from '../contract/event.js';
import { InputEventSchema } from '../contract/event.js';
import { createGamepadDiffer } from '../normalise/gamepad.js';
import { sequentialIds } from '../normalise/ids.js';
import { normaliseKeyboardEvent } from '../normalise/keyboard.js';
import { normalisePointerEvent } from '../normalise/pointer.js';
import { createTrackpadDetector, normaliseWheelEvent } from '../normalise/wheel.js';
import {
  DPAD_INDEX,
  gamepadSnapshot,
  KEY_EVENTS,
  MOUSE_CLICK,
  PEN_STROKE,
  TWO_FINGER_TOUCH,
  WHEEL_EVENTS,
} from './raw.js';

/**
 * Golden fixtures.
 *
 * The raw inputs in `raw.ts` are pushed through the normaliser with
 * deterministic ids and the result is committed as `golden/events.json`. Any
 * change to the vocabulary shows up here as a reviewable diff, which is the
 * point: this file is the contract's regression net for PAP-151, PAP-154,
 * PAP-155, PAP-157 and PAP-158, who all build on these shapes.
 *
 * Regenerate with `pnpm --filter @paperos/input gen:fixtures`.
 */
const here = dirname(fileURLToPath(import.meta.url));
const goldenPath = join(here, 'golden', 'events.json');
const write = process.env.PAPEROS_WRITE_FIXTURES === '1';

const SURFACE = { surfaceId: 'playground', surfaceRect: { left: 40, top: 100 } } as const;

/** Produce the whole golden stream. Pure: same input, same output, every run. */
export function buildGoldenEvents(): { name: string; event: InputEvent }[] {
  const newId = sequentialIds('evt');
  const out: { name: string; event: InputEvent }[] = [];

  const pointerGroups: [string, readonly (typeof MOUSE_CLICK)[number][]][] = [
    ['mouse-click', MOUSE_CLICK],
    ['pen-stroke', PEN_STROKE],
    ['two-finger-touch', TWO_FINGER_TOUCH],
  ];
  for (const [name, raw] of pointerGroups) {
    for (const event of raw) {
      const normalised = normalisePointerEvent(event, { ...SURFACE, newId });
      if (normalised !== null) out.push({ name: `${name}/${normalised.kind}`, event: normalised });
    }
  }

  for (const platform of ['other', 'mac'] as const) {
    for (const raw of KEY_EVENTS) {
      const normalised = normaliseKeyboardEvent(raw, { ...SURFACE, newId, platform });
      if (normalised !== null) out.push({ name: `key/${platform}/${raw.code}`, event: normalised });
    }
  }

  const detector = createTrackpadDetector();
  for (const raw of WHEEL_EVENTS) {
    out.push({
      name: `wheel/mode-${raw.deltaMode}`,
      event: normaliseWheelEvent(raw, { ...SURFACE, newId, detector, viewportHeight: 900 }),
    });
  }

  // A d-pad press, held long enough to auto-repeat, then released.
  const differ = createGamepadDiffer({ ...SURFACE, newId });
  const held = gamepadSnapshot([DPAD_INDEX.down]);
  const released = gamepadSnapshot([]);
  for (const [timeStamp, snapshot] of [
    [6000, held],
    [6016, held],
    [6500, held],
    [6600, released],
  ] as const) {
    for (const event of differ.poll([snapshot], timeStamp)) {
      out.push({ name: `gamepad/${event.button}/${event.phase}`, event });
    }
  }

  return out;
}

describe('golden fixtures', () => {
  const events = buildGoldenEvents();

  it('matches the committed golden file', () => {
    const serialised = `${JSON.stringify(events, null, 2)}\n`;
    if (write) {
      mkdirSync(dirname(goldenPath), { recursive: true });
      writeFileSync(goldenPath, serialised, 'utf8');
    }
    expect(existsSync(goldenPath), 'golden/events.json is missing; run pnpm gen:fixtures').toBe(
      true,
    );
    expect(readFileSync(goldenPath, 'utf8')).toBe(serialised);
  });

  it('every golden event validates against InputEventSchema', () => {
    for (const { name, event } of events) {
      const result = InputEventSchema.safeParse(event);
      expect(
        result.success,
        `${name}: ${result.success ? '' : JSON.stringify(result.error.issues)}`,
      ).toBe(true);
    }
  });

  it('covers every kind the union declares except voice, which has no DOM source', () => {
    const kinds = new Set(events.map(({ event }) => event.kind));
    expect([...kinds].sort()).toEqual([
      'cancel',
      'gamepad',
      'key',
      'move',
      'press',
      'release',
      'wheel',
    ]);
  });
});
