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
