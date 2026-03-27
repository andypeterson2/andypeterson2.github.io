import { test, expect } from '@playwright/test';

test.describe('Site navigation', () => {
  test('home page renders with title and featured projects', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Projects|Portfolio/);
    await expect(page.locator('.greeting')).toBeVisible();
    await expect(page.locator('.icon-grid .finder-icon').first()).toBeVisible();
  });

  test('desktop menubar links work', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('.site-menubar');

    await nav.locator('a[href="/projects/"]').click();
    await expect(page).toHaveURL('/projects/');

    await nav.locator('a[href="/about"]').click();
    await expect(page).toHaveURL('/about');

    await nav.locator('a[href="/contact"]').click();
    await expect(page).toHaveURL('/contact');
  });

  test('breadcrumb navigation renders on subpages', async ({ page }) => {
    await page.goto('/projects/');
    const breadcrumbs = page.locator('.details-bar');
    await expect(breadcrumbs).toBeVisible();
    await expect(breadcrumbs.locator('.crumb-heart')).toBeVisible();
  });

  test('home heart icon in menubar links to root', async ({ page }) => {
    await page.goto('/about');
    await page.locator('.heart-item a').click();
    await expect(page).toHaveURL('/');
  });

  test('back-to-top button appears on scroll', async ({ page }) => {
    await page.goto('/about');
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
