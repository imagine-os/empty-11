import type { Page } from '@playwright/test';
import { type ParsedChord, type Platform, parseChord, platformFrom } from '../chord/index.js';
import { sleep } from './errors.js';

/**
 * Keyboard helpers that speak the product's own chord grammar (`mod+shift+k`,
 * see `packages/input/src/chord/`), so a test reads like the keymap it checks.
 *
 * `mod` is resolved from the **page**, not from the runner: a Linux runner
 * emulating a macOS user agent presses Meta, because that is what the app
 * under test will be matching against.
 */

export interface ChordOptions {
  /** Override platform detection (`'mac'` presses Meta for `mod`). */
  readonly platform?: Platform;
  /** Delay between key down and key up, in ms. */
  readonly delayMs?: number;
}

export interface SequenceOptions extends ChordOptions {
  /** Gap between chords, in ms. Default 80, comfortably inside a sequence timeout. */
  readonly gapMs?: number;
}

/**
 * The platform the page reports, read from `navigator.userAgentData.platform`
 * when present and `navigator.platform` otherwise.
 */
export async function pagePlatform(page: Page): Promise<Platform> {
  const reported = await page.evaluate(() => {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    return nav.userAgentData?.platform ?? nav.platform ?? '';
  });
  return platformFrom(reported);
}

/** The token Playwright's `keyboard.press` expects for the chord's key. */
function keyTokenOf(parsed: ParsedChord): string {
  if (parsed.code !== null) return parsed.code;
  if (parsed.key !== null) return parsed.key;
  throw new Error(`Chord ${JSON.stringify(parsed.chord)} resolves to no key`);
}

/**
 * Translate a portable chord into Playwright's `Modifier+Key` spelling, e.g.
 * `mod+shift+k` → `Control+Shift+KeyK` (other) or `Meta+Shift+KeyK` (mac).
 * Pure; exported for tests and for consumers building their own presses.
 */
export function toPlaywrightKey(chord: string, platform: Platform): string {
  const parsed = parseChord(chord);
  const parts: string[] = [];
  if (parsed.ctrl || (parsed.mod && platform !== 'mac')) parts.push('Control');
  if (parsed.alt) parts.push('Alt');
  if (parsed.shift) parts.push('Shift');
  if (parsed.meta || (parsed.mod && platform === 'mac')) parts.push('Meta');
  parts.push(keyTokenOf(parsed));
  return parts.join('+');
}

/** Press one chord on the focused element. */
export async function pressChord(
  page: Page,
  chord: string,
  options: ChordOptions = {},
): Promise<void> {
  const platform = options.platform ?? (await pagePlatform(page));
  const key = toPlaywrightKey(chord, platform);
  await page.keyboard.press(key, options.delayMs === undefined ? {} : { delay: options.delayMs });
}

/**
 * Press a whitespace-separated sequence of chords (`'g i'`, `'mod+k p'`) with
 * a realistic gap between them.
 */
export async function sequence(
  page: Page,
  chords: string,
  options: SequenceOptions = {},
): Promise<void> {
  const tokens = chords.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) throw new Error(`Empty sequence: ${JSON.stringify(chords)}`);
  const platform = options.platform ?? (await pagePlatform(page));
  const gapMs = options.gapMs ?? 80;
  for (const [index, token] of tokens.entries()) {
    if (index > 0) await sleep(gapMs);
    await pressChord(page, token, { ...options, platform });
  }
}

export interface HoldOptions extends ChordOptions {
  /**
   * Emulate the OS key auto-repeat while the key is held: after `delayMs`,
   * a `keydown` with `repeat: true` every `intervalMs`. `false` holds silently.
   * Default `{ delayMs: 500, intervalMs: 50 }`, a typical desktop setting.
   */
  readonly repeat?: false | { readonly delayMs?: number; readonly intervalMs?: number };
}

/**
 * Hold a key (or chord) down for `ms`, with auto-repeat like a real keyboard,
 * then release it in reverse order, so long-press and hold-to-repeat
 * behaviour can be tested.
 */
export async function holdKey(
  page: Page,
  chord: string,
  ms: number,
  options: HoldOptions = {},
): Promise<void> {
  const platform = options.platform ?? (await pagePlatform(page));
  const keys = toPlaywrightKey(chord, platform).split('+');
  const main = keys[keys.length - 1] ?? chord;
  const repeat = options.repeat === false ? null : (options.repeat ?? {});
  const delayMs = repeat?.delayMs ?? 500;
  const intervalMs = repeat?.intervalMs ?? 50;

  const started = Date.now();
  for (const key of keys) await page.keyboard.down(key);
  if (repeat === null || ms <= delayMs) {
    await sleep(ms);
  } else {
    await sleep(delayMs);
    while (Date.now() - started < ms) {
      // Playwright marks a second `down` of an already-held key as `repeat: true`.
      await page.keyboard.down(main);
      await sleep(Math.min(intervalMs, Math.max(0, ms - (Date.now() - started))));
    }
  }
  for (const key of [...keys].reverse()) await page.keyboard.up(key);
}
