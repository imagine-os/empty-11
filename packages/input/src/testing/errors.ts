/**
 * Errors the fixtures throw. They are classes, not strings, so a consumer can
 * `test.skip` on the exact condition instead of matching a message.
 */

/** A helper needed the Chrome DevTools Protocol and the browser has none. */
export class CdpUnavailableError extends Error {
  override readonly name = 'CdpUnavailableError';

  constructor(helper: string, browserName: string) {
    super(
      `${helper} needs the Chrome DevTools Protocol, which ${browserName} does not expose. ` +
        'Run this test on the chromium project (`playwright test --project=chromium`), or skip it ' +
        "explicitly: `test.skip(browserName !== 'chromium', 'touch and pen need CDP')`. " +
        'The fixture never silently passes here.',
    );
  }
}

/** A helper needed a DOM contract the page under test does not provide. */
export class MissingContractError extends Error {
  override readonly name = 'MissingContractError';
}

/** Pause for `ms`; the fixtures use real time so gesture timing is realistic. */
export function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
