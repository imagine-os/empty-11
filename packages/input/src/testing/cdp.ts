import type { CDPSession, Locator, Page } from '@playwright/test';
import { CdpUnavailableError } from './errors.js';

/**
 * One CDP session per page, opened lazily and reused by every touch and pen
 * helper. Touch emulation is switched on the first time a session is opened,
 * because `Input.dispatchTouchEvent` is refused by Chromium otherwise.
 */
const sessions = new WeakMap<Page, Promise<CDPSession>>();

/** Playwright's browser name for a page, `'chromium'` when it cannot tell. */
export function browserNameOf(page: Page): string {
  return page.context().browser()?.browserType().name() ?? 'chromium';
}

/** True when the page's browser speaks CDP (Chromium and its derivatives). */
export function cdpAvailable(page: Page): boolean {
  return browserNameOf(page) === 'chromium';
}

/** The page's CDP session, or a `CdpUnavailableError` naming the helper. */
export function cdpSession(page: Page, helper: string): Promise<CDPSession> {
  if (!cdpAvailable(page)) {
    return Promise.reject(new CdpUnavailableError(helper, browserNameOf(page)));
  }
  let pending = sessions.get(page);
  if (!pending) {
    pending = page
      .context()
      .newCDPSession(page)
      .then(async (session) => {
        await session.send('Emulation.setTouchEmulationEnabled', {
          enabled: true,
          maxTouchPoints: 5,
        });
        return session;
      });
    sessions.set(page, pending);
    page.once('close', () => sessions.delete(page));
  }
  return pending;
}

/** A point in CSS pixels relative to the viewport. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A locator or an absolute viewport point; every helper accepts either. */
export type Target = Locator | Point;

function isLocator(target: Target): target is Locator {
  return typeof (target as Locator).boundingBox === 'function';
}

/** The viewport-relative box of a locator, scrolled into view first. */
export async function boxOf(
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(
      `Cannot resolve a bounding box for ${String(locator)}: the element is detached, hidden or has no layout.`,
    );
  }
  return box;
}

/** The centre of a target in viewport CSS pixels. */
export async function centreOf(target: Target): Promise<Point> {
  if (!isLocator(target)) return target;
  const box = await boxOf(target);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** The top-left corner of a target, the origin pen strokes are drawn from. */
export async function originOf(target: Target): Promise<Point> {
  if (!isLocator(target)) return target;
  const box = await boxOf(target);
  return { x: box.x, y: box.y };
}
