import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { framesToFps } from './fps.ts';
import { emptyBrowser, type BrowserResult } from './schema.ts';

/**
 * Chromium is pre-downloaded on PaperOS build containers at
 * `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`; a session without that env var
 * or directory (a laptop, a different CI runner) still gets a clean `null`
 * result instead of a crash — see "Declaring null" in this kit's README
 * "Declaring not measured".
 */
export function chromiumAvailable(): boolean {
  return findCachedChromeExecutable() !== null;
}

/**
 * Finds the `chrome` binary directly under `PLAYWRIGHT_BROWSERS_PATH`,
 * instead of asking `@playwright/test` to resolve its own expected revision.
 *
 * Deviation: `@playwright/test`'s installed version and the Chromium build
 * cached at `/opt/pw-browsers` are versioned independently on this
 * container — `pnpm install`'s resolved `@playwright/test` can land on a
 * revision newer than what's cached (`chromium.launch()` then refuses with
 * "Executable doesn't exist", asking for a `playwright install` this
 * sandbox's network policy may not allow). Scanning for any cached
 * `chromium-<revision>/chrome-linux/chrome` and passing it as
 * `executablePath` bypasses that revision check; Playwright's `launch()`/CDP protocol is
 * stable across nearby versions, so an older cached Chromium still drives a
 * newer `@playwright/test` correctly. Noted as a deviation in the PAP-753
 * `Session ended` comment.
 */
function findCachedChromeExecutable(): string | null {
  const dir = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!dir) return null;
  try {
    if (!existsSync(dir)) return null;
    const revisionDirs = readdirSync(dir).filter((name) => /^chromium-\d+$/.test(name));
    for (const revisionDir of revisionDirs) {
      const candidate = join(dir, revisionDir, 'chrome-linux', 'chrome');
      if (existsSync(candidate)) return candidate;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Opens `url` in headless Chromium and samples `requestAnimationFrame`
 * intervals for `durationMs` (default 5000, matching the reference profile's
 * 5s scroll/pan window). Reports mean and p5 FPS and a count of "long frames"
 * (>50ms, i.e. slower than 20fps for that one frame).
 *
 * Deviation from the original PAP-753 spec text: the spec describes reading
 * Chrome DevTools Protocol `DrawFrame` trace events. This kit instead samples
 * `requestAnimationFrame` timestamps from inside the page over the same
 * window. Reasoning: a rAF-based sample needs no CDP tracing plumbing (no
 * `browser.newCDPSession`, no trace category list, no protobuf-ish event
 * parsing) and reports the same mean/p5 FPS numbers a DrawFrame trace would,
 * at the cost of not separately distinguishing compositor-only frames from
 * main-thread frames — a distinction none of PAP-753's five consumer spikes'
 * specs (PAP-212, PAP-292, PAP-293, PAP-294, PAP-127) rely on. Noted as a
 * deviation in the PAP-753 `Session ended` comment.
 */
export async function measureBrowserFps(options: {
  url: string;
  durationMs?: number;
  interact?: (page: import('@playwright/test').Page) => Promise<void>;
}): Promise<BrowserResult> {
  const executablePath = findCachedChromeExecutable();
  if (!executablePath) {
    return emptyBrowser('chromium unavailable: no cached chromium-*/chrome-linux/chrome under PLAYWRIGHT_BROWSERS_PATH');
  }

  const { chromium } = await import('@playwright/test');
  const durationMs = options.durationMs ?? 5000;

  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ headless: true, executablePath });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(options.url, { waitUntil: 'load' });

    // Evaluated as a raw string, not a TS function reference: tsx's esbuild
    // transform runs with `keepNames` on, which injects a `__name(fn, ...)`
    // helper call around any named function for stack-trace fidelity in
    // Node — a helper that does not exist once Playwright serializes the
    // function's source and re-parses it inside the page, so a compiled
    // function reference throws `ReferenceError: __name is not defined`
    // in-browser. A plain string is never run through that transform.
    const samplePromise = page.evaluate(
      `new Promise((resolvePromise) => {
        const intervals = [];
        let last = performance.now();
        const end = last + ${durationMs};
        function tick(now) {
          intervals.push(now - last);
          last = now;
          if (now < end) {
            requestAnimationFrame(tick);
          } else {
            resolvePromise(intervals);
          }
        }
        requestAnimationFrame(tick);
      })`,
    ) as Promise<number[]>;

    if (options.interact) {
      await options.interact(page);
    }

    const intervals = await samplePromise;
    await browser.close();
    browser = undefined;

    if (intervals.length < 2) {
      return emptyBrowser('fewer than 2 animation frames observed in the sample window');
    }

    const fps = framesToFps(intervals.slice(1));
    if (!fps) return emptyBrowser('fewer than 2 animation frames observed in the sample window');

    return { ...fps, notMeasuredReason: null };
  } catch (err) {
    return emptyBrowser(`playwright run failed: ${(err as Error).message}`);
  } finally {
    await browser?.close().catch(() => {});
  }
}
