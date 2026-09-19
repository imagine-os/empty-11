/**
 * PAP-14 — throwaway Playwright script, screenshots the placeholder app at
 * all seven breakpoints plus the two extra DPR variants the test plan asks
 * for (390 @ DPR3, 1920 @ DPR1). Not a permanent suite (PAP-82 owns the
 * real visual-regression project) — delete once its baselines exist.
 *
 * NOT RUN as part of this issue: `@playwright/test` is not yet a workspace
 * dependency (PAP-82 owns adding it as the real visual-regression project),
 * so `pnpm exec playwright test scripts/matrix-shots.spec.ts` has nothing to
 * execute against yet even though `apps/web` (PAP-13) has a placeholder
 * route to point it at. See the PAP-14 build report. Once Playwright is
 * installed, run `pnpm --filter @paperos/web dev` and point PLACEHOLDER_URL
 * (or Playwright's `baseURL`) at it — this script runs as-is.
 */
import { test } from '@playwright/test';
import {
  BREAKPOINTS,
  PLAYWRIGHT_DEVICES,
  PLAYWRIGHT_EXTRA_VARIANTS,
} from '../packages/core/src/devices/matrix.js';

const PLACEHOLDER_URL = process.env.PLACEHOLDER_URL ?? '/';

test.describe('device matrix — placeholder screenshots', () => {
  for (const bp of BREAKPOINTS) {
    const cfg = PLAYWRIGHT_DEVICES[bp.name];
    test(`${bp.name} (${cfg.viewport.width}x${cfg.viewport.height})`, async ({ page }) => {
      await page.setViewportSize(cfg.viewport);
      await page.goto(PLACEHOLDER_URL);
      await page.screenshot({
        path: `test-results/matrix-${bp.name}-${cfg.viewport.width}x${cfg.viewport.height}.png`,
        fullPage: true,
      });
    });
  }

  for (const [key, cfg] of Object.entries(PLAYWRIGHT_EXTRA_VARIANTS)) {
    test(`extra variant ${key}`, async ({ page }) => {
      await page.setViewportSize(cfg.viewport);
      await page.goto(PLACEHOLDER_URL);
      await page.screenshot({ path: `test-results/matrix-${key}.png`, fullPage: true });
    });
  }
});
