import { test, expect } from '@playwright/test';

test.describe('Error paths and 404 handling', () => {
  test('unknown URL returns 404 status and renders error page', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist/');
    expect(response?.status()).toBe(404);
    await expect(page.locator('.error-code')).toContainText('404');
  });

  test('404 page uses consistent window chrome', async ({ page }) => {
    await page.goto('/absolutely-nowhere/');
    // The 404 page uses its own error-window rather than the site-window layout
    await expect(page.locator('.error-window')).toBeVisible();
    await expect(page.locator('.error-window .title-bar')).toBeVisible();
  });

  test('404 page includes navigation back to home', async ({ page }) => {
    await page.goto('/not-a-page/');
    // Heart icon or link back to home should be present
    const homeLinks = page.locator('a[href="/"]');
    const count = await homeLinks.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Backend error-envelope surfacing', () => {
  test('nonogram benchmark surfaces error.code from the contract envelope', async ({ page }) => {
    // /health ok so the connect succeeds; the benchmark POST returns a 409 envelope.
    await page.route('**/health', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', service: 'nonogram', version: '1', uptime_s: 1 }),
      }),
    );
    // Mock both transports' routes so the error surfaces whichever path the app takes
    // (streaming when the socket is up, synchronous REST otherwise).
    const busy = {
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'solver_busy', message: 'A solve is already running' } }),
    };
    await page.route('**/api/benchmark', (r) => r.fulfill(busy));
    await page.route('**/api/benchmark/sync', (r) => r.fulfill(busy));
    await page.goto('/projects/quantum-nonogram-solver/app/');
    await page.locator('.server-nav-item').click(); // open connect modal (defaults localhost:5055)
    await page.locator('.sn-modal [data-action="connect"]').click(); // sets API_BASE
    await page.locator('#btn-bench').click();
    // The status line surfaces the contract error code instead of failing silently.
    await expect(page.locator('#status-line')).toContainText('solver_busy', { timeout: 5000 });
  });
});

test.describe('Sync-REST fallback when streaming is unavailable', () => {
  test('nonogram falls back to /api/benchmark/sync when Socket.IO is blocked', async ({ page }) => {
    // Block Socket.IO so the live transport never connects; the benchmark must then go
    // through the synchronous REST route rather than the streaming one.
    await page.route('**/socket.io/**', (r) => r.abort());
    await page.route('**/health', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', service: 'nonogram', version: '1', uptime_s: 1 }),
      }),
    );
    let streamHit = false;
    let syncHit = false;
    await page.route('**/api/benchmark', (r) => {
      streamHit = true;
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.route('**/api/benchmark/sync', (r) => {
      syncHit = true;
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          report: {}, solutions: [], qu_counts: {}, qu_counts_per_trial: null,
          rows: 0, cols: 0, cl_times: [], qu_times: [],
        }),
      });
    });
    await page.goto('/projects/quantum-nonogram-solver/app/');
    await page.locator('.server-nav-item').click();
    await page.locator('.sn-modal [data-action="connect"]').click();
    await page.waitForTimeout(600); // blocked socket settles → socket.connected stays false
    await page.locator('#btn-bench').click();
    await expect.poll(() => syncHit, { timeout: 10000 }).toBe(true);
    expect(streamHit).toBe(false); // the streaming route is NOT used when the socket is down
  });
});
