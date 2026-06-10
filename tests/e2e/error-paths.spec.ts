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
    await page.route('**/api/benchmark', (r) =>
      r.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'solver_busy', message: 'A solve is already running' } }),
      }),
    );
    await page.goto('/projects/quantum-nonogram-solver/app/');
    await page.locator('.server-nav-item').click(); // open connect modal (defaults localhost:5055)
    await page.locator('.sn-modal [data-action="connect"]').click(); // sets API_BASE
    await page.locator('#btn-bench').click();
    // The status line surfaces the contract error code instead of failing silently.
    await expect(page.locator('#status-line')).toContainText('solver_busy', { timeout: 5000 });
  });
});
