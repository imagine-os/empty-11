import { defineConfig, devices } from '@playwright/test';

/**
 * Self-tests of `@paperos/input/testing` against the static page in `e2e/`.
 * No app, no server: they never block on an app build.
 *
 * `pnpm --filter @paperos/input test:e2e` runs the chromium project (the only
 * browser the touch and pen helpers can drive); `test:e2e:all` adds firefox
 * and webkit, where those helpers skip with a message.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.e2e\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  use: {
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
