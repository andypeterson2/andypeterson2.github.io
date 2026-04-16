import { test, expect } from '@playwright/test';

/**
 * Visual regression tests — Playwright compares a fresh screenshot
 * against committed baselines. Baselines live in
 * tests/e2e/visual-regression.spec.ts-snapshots/ and are regenerated
 * with: npx playwright test visual-regression --update-snapshots
 *
 * Scope is intentionally narrow: only full-page screenshots for a few
 * stable pages. Dynamic content (project detail prev/next) is avoided
 * to keep baselines deterministic.
 */

// Skip in CI by default: baselines are committed only for darwin (local dev).
// Run in CI by setting VISUAL_REGRESSION=1 and regenerating linux baselines.
const SKIP_VISUAL = !!process.env.CI && !process.env.VISUAL_REGRESSION;

test.describe('Visual regression', () => {
  test.skip(SKIP_VISUAL, 'Visual regression disabled in CI without VISUAL_REGRESSION=1');

  // Stabilize fonts and animations before capturing
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      document.documentElement.style.setProperty('--animation-duration', '0s');
    });
  });

  test('home page matches baseline', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('home.png', { fullPage: true });
  });

  test('about page matches baseline', async ({ page }) => {
    await page.goto('/about/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('about.png', { fullPage: true });
  });

  test('projects index matches baseline', async ({ page }) => {
    await page.goto('/projects/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('projects.png', { fullPage: true });
  });

  test('404 page matches baseline', async ({ page }) => {
    await page.goto('/this-does-not-exist/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('404.png', { fullPage: true });
  });

  test('classifier app shell matches baseline', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await page.route('**/health', (route) => route.abort());
    await page.goto('/classifiers/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('classifier-shell.png', { fullPage: true });
  });
});
