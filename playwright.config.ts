import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /classifier-live\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Drives a localhost SSE stub, which needs connect-src widened (port 4322).
      name: 'chromium-dev-csp',
      testMatch: /classifier-live\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4322' },
    },
    // firefox + webkit are slower; run them only in full sweeps (E2E_ALL_BROWSERS=1,
    // e.g. a nightly or workflow_dispatch run) so PR feedback stays fast on chromium.
    ...(process.env.E2E_ALL_BROWSERS === '1'
      ? [
          {
            name: 'firefox',
            testIgnore: /classifier-live\.spec\.ts/,
            use: { ...devices['Desktop Firefox'] },
          },
          {
            name: 'webkit',
            testIgnore: /classifier-live\.spec\.ts/,
            use: { ...devices['Desktop Safari'] },
          },
        ]
      : []),
  ],
  // Both servers serve the built output — the bytes that deploy, purged CSS and
  // hashed CSP included. 4322 differs in one directive only: connect-src also
  // admits localhost, for the specs driving a local stub server. Build first.
  webServer: [
    {
      command: 'node scripts/serve-dist.mjs 4321',
      url: 'http://localhost:4321',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'node scripts/serve-dist.mjs 4322 --allow-localhost-connect',
      url: 'http://localhost:4322',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
