import { test, expect } from '@playwright/test';

test.describe('Responsive layout', () => {
  test('desktop shows menubar, hides mobile nav', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.locator('.site-menubar')).toBeVisible();
    await expect(page.locator('.mobile-nav')).not.toBeVisible();
  });

  test('mobile hides menubar, shows the floating nav', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(page.locator('.site-menubar')).not.toBeVisible();
    await expect(page.locator('.mobile-nav-btn')).toBeVisible();
  });

  test('the floating nav opens and navigates to pages', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.locator('.mobile-nav-btn').click();
    await page.locator('#mobile-nav-menu a').filter({ hasText: 'About' }).click();
    await expect(page).toHaveURL('/about/');
  });

  test('window chrome renders at all breakpoints', async ({ page }) => {
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      // Scope to the site window's own chrome — page content has its own windows.
      await expect(page.locator('.site-window')).toBeVisible();
      await expect(page.locator('.site-window > .title-bar')).toBeVisible();
      await expect(page.locator('.site-window > .details-bar')).toBeVisible();
    }
  });
});
