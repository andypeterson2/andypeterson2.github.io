import { defineConfig, devices } from '@playwright/test';

/** Specs that drive a stub server on localhost, so they need connect-src widened. */
const LOCALHOST_STUB_SPECS = /(classifier-live|nonogram-hardware)\.spec\.ts/;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Capped rather than left to the core count. The nonogram page builds a Grover
  // circuit and drives a canvas in the browser, so a context per core starves the
  // others and a different handful of solver assertions times out each run. Four
  // passes repeatedly and finishes faster than the serial run it replaces.
  workers: process.env.CI ? 1 : 4,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: LOCALHOST_STUB_SPECS,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Drives a localhost stub, which needs connect-src widened (port 4322).
      name: 'chromium-dev-csp',
      testMatch: LOCALHOST_STUB_SPECS,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4322' },
    },
    // firefox + webkit are slower; run them only in full sweeps (E2E_ALL_BROWSERS=1,
    // e.g. a nightly or workflow_dispatch run) so PR feedback stays fast on chromium.
    ...(process.env.E2E_ALL_BROWSERS === '1'
      ? [
          {
            name: 'firefox',
            testIgnore: LOCALHOST_STUB_SPECS,
            use: { ...devices['Desktop Firefox'] },
          },
          {
            name: 'webkit',
            testIgnore: LOCALHOST_STUB_SPECS,
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
