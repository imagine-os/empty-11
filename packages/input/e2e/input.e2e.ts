import { fileURLToPath } from 'node:url';
import { STANDARD_BUTTON_MAP } from '../src/contract/gamepad.js';
import { CdpUnavailableError, expect, tap, test, toPlaywrightKey } from '../src/testing/index.js';

/**
 * Self-tests: each helper produces the DOM events the static page records.
 * They are also the reference usage of the fixture for every consumer
 * (PAP-341, PAP-167, PAP-155, PAP-156, PAP-83).
 */

const PAGE = fileURLToPath(new URL('./self-test.html', import.meta.url));

type LogEntry = Record<string, unknown> & { kind: string };

/** Keydowns of the chord's own key, not of the modifiers pressed on the way. */
const MODIFIER_CODE = /^(Control|Shift|Alt|Meta)(Left|Right)$/;
const chordKeys = (log: LogEntry[]) =>
  log.filter(
    (entry) =>
      entry.kind === 'key' && !MODIFIER_CODE.test(String(entry.key).split('+').at(-1) ?? ''),
  );

const readLog = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { __log: LogEntry[] }).__log);

test.beforeEach(async ({ page }) => {
  await page.goto(`file://${PAGE}`);
});

test.describe('chords', () => {
  test('pressChord resolves mod from the page platform', async ({ page, input }) => {
    await page.locator('#chord-target').focus();
    await input.pressChord('mod+shift+k');
    const platform = await page.evaluate(() => navigator.platform);
    const expected = toPlaywrightKey('mod+shift+k', /mac/i.test(platform) ? 'mac' : 'other');
    const keys = chordKeys(await readLog(page));
    expect(keys.map((entry) => entry.key)).toEqual([expected]);
    await input.expectModality('keyboard');
  });

  test('sequence presses chords with a gap; holdKey repeats', async ({ page, input }) => {
    await page.locator('#chord-target').focus();
    await input.sequence('g i', { gapMs: 120 });
    const keys = chordKeys(await readLog(page));
    expect(keys.map((entry) => entry.key)).toEqual(['KeyG', 'KeyI']);
    const [g, i] = keys;
    expect(Number(i?.t) - Number(g?.t)).toBeGreaterThanOrEqual(100);

    await page.evaluate(() => (window as unknown as { __clearLog: () => void }).__clearLog());
    await input.holdKey('space', 700);
    const held = (await readLog(page)).filter((entry) => entry.kind === 'key');
    expect(held.length).toBeGreaterThan(1);
    expect(held.some((entry) => entry.repeat === true)).toBe(true);
    expect((await readLog(page)).at(-1)?.kind).toBe('keyup');
  });
});

test.describe('touch (CDP)', () => {
  test('tap produces touchstart, touchend and a touch pointer', async ({ page, input }) => {
    // A 3 px wobble stays inside Chromium's own touch slop, so no touchmove reaches the page:
    // exactly what a real tap looks like.
    await input.tap(page.locator('#touch-target'), { slopPx: 3 });
    const kinds = (await readLog(page)).map((entry) => entry.kind);
    expect(kinds).toEqual(
      expect.arrayContaining(['touchstart', 'touchend', 'pointerdown', 'pointerup']),
    );
    expect(kinds).not.toContain('touchmove');
    expect((await readLog(page)).find((entry) => entry.kind === 'pointerdown')?.pointerType).toBe(
      'touch',
    );
    await input.expectModality('touch');
    await input.expectModality('pointer');
  });

  test('longPress holds past the threshold', async ({ page, input }) => {
    await input.longPress(page.locator('#touch-target'), { holdMs: 600 });
    const log = await readLog(page);
    const start = log.find((entry) => entry.kind === 'touchstart') as { t: number } | undefined;
    const end = log.find((entry) => entry.kind === 'touchend') as { t: number } | undefined;
    expect(start && end ? end.t - start.t : 0).toBeGreaterThanOrEqual(500);
  });

  test('swipe and pan move one finger; pinch uses two', async ({ page, input }) => {
    const target = page.locator('#touch-target');
    await input.swipe(target, { direction: 'left' });
    await input.pan(target, { dx: 30, dy: 30, steps: 4 });
    await input.pinch(target, { scale: 2, steps: 4 });
    const log = await readLog(page);
    const maxTouches = Math.max(...log.map((entry) => Number(entry.touches ?? 0)));
    expect(maxTouches).toBe(2);
    // Browsers coalesce touchmove per frame, so assert movement happened, not how many events.
    expect(log.filter((entry) => entry.kind === 'touchmove').length).toBeGreaterThanOrEqual(3);
  });

  test('the standalone helper throws off Chromium instead of passing', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'chromium', 'only meaningful where CDP is missing');
    await expect(tap(page, page.locator('#touch-target'))).rejects.toBeInstanceOf(
      CdpUnavailableError,
    );
  });
});

test.describe('pen (CDP)', () => {
  test('draws a stroke with pressure and pointerType pen', async ({ page, input }) => {
    await input.pen(
      page.locator('#pen-canvas'),
      [
        [
          { x: 10, y: 10 },
          { x: 120, y: 60, pressure: 0.9 },
          { x: 230, y: 110 },
        ],
      ],
      { pressure: 0.5 },
    );
    const log = await readLog(page);
    const down = log.find((entry) => entry.kind === 'pen-down');
    const moves = log.filter((entry) => entry.kind === 'pen-move');
    expect(down).toMatchObject({ pointerType: 'pen', pressure: 0.5 });
    expect(moves.map((entry) => entry.pressure)).toEqual([0.9, 0.5]);
    expect(log.at(-1)).toMatchObject({ kind: 'pen-up', pointerType: 'pen' });
    await input.expectModality('pen');
  });
});

test.describe('gamepad mock', () => {
  test('connects, presses by name and moves a stick', async ({ page, input }) => {
    const pad = await input.gamepad();
    await pad.connect({ id: 'Test Pad (STANDARD GAMEPAD)' });
    await expect(page.locator('#gamepad-status')).toContainText('Test Pad');
    await pad.press('a');
    await pad.hold('down');
    await expect(page.locator('#gamepad-status')).toContainText(
      `buttons=[${STANDARD_BUTTON_MAP.indexOf('down')}]`,
    );
    await pad.release('down');
    await pad.stick('left', 1, 0);
    await expect(page.locator('#gamepad-status')).toContainText('axes=[1.00,0.00,0.00,0.00]');
    const state = await pad.state();
    expect(state.axes[0]).toBe(1);
    await pad.disconnect();
    await expect(page.locator('#gamepad-status')).toHaveText('no pad');
    const kinds = (await readLog(page)).map((entry) => entry.kind);
    expect(kinds).toEqual(expect.arrayContaining(['gamepadconnected', 'gamepaddisconnected']));
  });
});

test.describe('drag', () => {
  test('dragKeyboard follows the PAP-330 grammar and announces', async ({ page, input }) => {
    const handle = page.getByRole('button', { name: 'Drag Item A' });
    await input.dragKeyboard(handle, 'down down');
    await input.expectAnnouncement(/Dropped Item A at position 3 of 3/);
    expect(
      await page.evaluate(() => (window as unknown as { __order: () => string }).__order()),
    ).toBe('BCA');
    await expect(handle).toBeFocused();

    await input.dragKeyboard(handle, 'up', { cancel: true });
    await input.expectAnnouncement(/Cancelled moving Item A/, { politeness: 'polite' });
    expect(
      await page.evaluate(() => (window as unknown as { __order: () => string }).__order()),
    ).toBe('BCA');
  });

  test('dragPointer crosses the threshold and drops', async ({ page, input }) => {
    await input.dragPointer(page.locator('#drag-source'), page.locator('#drop-zone'));
    await expect(page.locator('#drop-zone')).toHaveText('dropped');
    await input.expectModality('mouse');
  });
});

test.describe('audits', () => {
  test('touchTargets passes on the page and catches a 24 px control', async ({ page, input }) => {
    const clean = await input.expectTouchTargets();
    expect(clean.checked).toBeGreaterThan(5);
    await page.evaluate(() =>
      (window as unknown as { __addTinyButton: () => void }).__addTinyButton(),
    );
    const report = await input.touchTargets();
    expect(report.violations).toEqual([
      { selector: 'button#tiny', label: 'x', width: 24, height: 24 },
    ]);
  });

  test('expectAnnouncement fails with guidance when no live region exists', async ({
    page,
    input,
  }) => {
    await page.evaluate(() => {
      for (const region of document.querySelectorAll(
        '[aria-live], [role="status"], [role="alert"]',
      )) {
        region.remove();
      }
    });
    await expect(input.expectAnnouncement(/anything/)).rejects.toThrow(
      /Mount the shared `LiveAnnouncer`/,
    );
  });
});
