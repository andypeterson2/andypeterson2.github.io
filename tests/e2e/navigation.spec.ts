import { test, expect } from '@playwright/test';

test.describe('Site navigation', () => {
  test('home page renders the bio and the project timeline', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ \u2014 /);
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

// The page scrolls inside its window, so the pane's position is kept per history entry.
test.describe('The window pane keeps its place', () => {
  const paneTop = (page: import('@playwright/test').Page) =>
    page.locator('.site-pane').evaluate((el) => el.scrollTop);

  test('a reload lands where the reader was', async ({ page }) => {
    await page.goto('/');
    await page.locator('.site-pane').evaluate((el) => (el.scrollTop = 1500));
    await expect.poll(() => page.evaluate(() => history.state?.paneTop)).toBe(1500);
    await page.reload();
    await expect.poll(() => paneTop(page)).toBe(1500);
  });

  test('Back from a demo returns to the same place', async ({ page }) => {
    await page.goto('/');
    await page.locator('.site-pane').evaluate((el) => (el.scrollTop = 1200));
    await expect.poll(() => page.evaluate(() => history.state?.paneTop)).toBe(1200);
    await page.goto('/projects/quantum-nonogram-solver/app/');
    await page.goBack();
    await expect.poll(() => paneTop(page)).toBe(1200);
  });

  test('Back across an in-page link returns to the same place', async ({ page }) => {
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => history.state?.paneTop ?? 0)).toBe(0);
    await page.locator('.site-pane').evaluate((el) => (el.scrollTop = 300));
    await expect.poll(() => page.evaluate(() => history.state?.paneTop)).toBe(300);
    await page.locator('.bio-links a[href="#projects"]').click();
    await expect.poll(() => paneTop(page)).toBeGreaterThan(300);
    await page.goBack();
    await expect.poll(() => paneTop(page)).toBe(300);
  });

  test('a fresh visit starts at the top', async ({ page }) => {
    await page.goto('/');
    expect(await paneTop(page)).toBe(0);
  });
});

test.describe('Theme', () => {
  test('loading a page stores nothing; switching stores the choice', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => localStorage.getItem('sm-theme'))).toBeNull();
    await page.locator('.site-menubar .theme-toggle').click();
    expect(await page.evaluate(() => localStorage.getItem('sm-theme'))).toBe('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
