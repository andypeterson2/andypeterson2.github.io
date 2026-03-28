import { test, expect } from '@playwright/test';

test.describe('Responsive layout', () => {
  test('desktop shows menubar, hides mobile header', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.locator('.site-menubar')).toBeVisible();
    await expect(page.locator('.mobile-header')).not.toBeVisible();
  });

  test('mobile hides menubar, shows mobile header', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(page.locator('.site-menubar')).not.toBeVisible();
    await expect(page.locator('.mobile-header')).toBeVisible();
  });

  test('mobile nav select navigates to pages', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.locator('.mobile-nav-select').selectOption('/about/');
    await expect(page).toHaveURL('/about/');
  });

  test('window chrome renders at all breakpoints', async ({ page }) => {
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await expect(page.locator('.site-window')).toBeVisible();
      await expect(page.locator('.title-bar')).toBeVisible();
      await expect(page.locator('.details-bar')).toBeVisible();
    }
  });
});
