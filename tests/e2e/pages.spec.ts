import { test, expect } from '@playwright/test';

test.describe('Core pages render without errors', () => {
  const pages = [
    { path: '/', title: /Home/ },
    { path: '/about', title: /About/ },
    { path: '/projects/', title: /Projects/ },
  ];

  for (const { path, title } of pages) {
    test(`${path} renders with correct title`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto(path);
      await expect(page).toHaveTitle(title);
      expect(errors).toEqual([]);
    });
  }

  test('404 page shows error dialog', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.locator('.error-code')).toContainText('404');
    await expect(page.locator('text=Lost in the superposition')).toBeVisible();
  });
});

test.describe('Projects index', () => {
  test('lists all projects as finder icons', async ({ page }) => {
    await page.goto('/projects/');
    const icons = page.locator('.icon-grid .finder-icon');
    await expect(icons.first()).toBeVisible();
    const count = await icons.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('project icons link to detail pages', async ({ page }) => {
    await page.goto('/projects/');
    const firstLink = page.locator('.icon-grid .finder-icon').first();
    const href = await firstLink.getAttribute('href');
    expect(href).toMatch(/^\/projects\/[\w-]+\/$/);
  });
});

test.describe('About page content', () => {
  test('has bio section with name', async ({ page }) => {
    await page.goto('/about');
    await expect(page.locator('.bio-window .title')).toBeVisible();
  });

  test('has section labels', async ({ page }) => {
    await page.goto('/about');
    const sections = page.locator('.section-label-text');
    const count = await sections.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

