import { test, expect } from '@playwright/test';

test.describe('Site navigation', () => {
  test('home page renders the bio and the project timeline', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Home/);
    await expect(page.locator('.bio-window')).toBeVisible();
    await expect(page.locator('.timeline-entry--project').first()).toBeVisible();
  });

  test('desktop menubar links work', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('.site-menubar');

    await nav.locator('a[href="/#projects"]').click();
    await expect(page).toHaveURL(/\/#projects$/);
    await expect(page.locator('#projects')).toBeVisible();

    // "Home" links back to the root (the flat layout renamed About → Home).
    await nav.locator('a[href="/"]').click();
    await expect(page).toHaveURL('/');
  });

  test('subpages have no breadcrumb bar (flat layout)', async ({ page }) => {
    await page.goto('/projects/ai-ml/app/');
    // The breadcrumb details-bar was removed; the menubar is the only nav chrome.
    await expect(page.locator('.site-window .details-bar')).toHaveCount(0);
    await expect(page.locator('.site-menubar a[href="/"]')).toBeVisible();
  });

  test('the heart in the menubar toggles the theme', async ({ page }) => {
    await page.goto('/');
    const heart = page.locator('.heart-toggle');
    await expect(heart).toBeVisible();
    const before = await page.evaluate(() => document.documentElement.dataset.theme ?? 'light');
    await heart.click();
    const after = await page.evaluate(() => document.documentElement.dataset.theme ?? 'light');
    expect(after).not.toBe(before);
  });

  test('back-to-top button appears on scroll', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('#back-to-top');
    await expect(btn).not.toHaveClass(/visible/);

    // Scroll the pane down
    await page.evaluate(() => {
      const pane = document.querySelector('.site-pane');
      if (pane) pane.scrollTop = 1000;
    });
    await expect(btn).toHaveClass(/visible/, { timeout: 3000 });
  });
});
