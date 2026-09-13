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
    await page.locator('#mobile-nav-menu a').filter({ hasText: 'Projects' }).click();
    await expect(page).toHaveURL(/\/#projects$/);
  });

  test('window chrome renders at all breakpoints', async ({ page }) => {
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      // Scope to the site window's own chrome — page content has its own windows.
      await expect(page.locator('.site-window')).toBeVisible();
      await expect(page.locator('.site-window > .title-bar')).toBeVisible();
    }
  });
});

// At 320 CSS px (a 1280px screen at 400% zoom) nothing scrolls sideways
// (WCAG 1.4.10 Reflow).
test.describe('Reflow at 320px', () => {
  for (const path of [
    '/',
    '/projects/ai-ml/app/',
    '/projects/quantum-nonogram-solver/app/',
    '/projects/latex-resume-editor/app/',
    '/nope',
  ]) {
    test(`no horizontal scroll on ${path}`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.route('**/api/**', (r) => r.abort());
      await page.goto(path);
      await page.waitForTimeout(500);
      const overflow = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        return [...document.querySelectorAll('body *')]
          .filter((e) => {
            const r = e.getBoundingClientRect();
            // SVG internals are clipped by their own viewport; they can't scroll the page.
            if (e.closest('svg') && e.tagName.toLowerCase() !== 'svg') return false;
            return r.width > 0 && r.right > vw + 1 && getComputedStyle(e).position !== 'fixed';
          })
          .slice(0, 3)
          .map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}`);
      });
      expect(overflow).toEqual([]);
    });
  }
});
