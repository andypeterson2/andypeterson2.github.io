import { test, expect } from '@playwright/test';

test.describe('Keyboard navigation', () => {
  test('tab moves focus through interactive elements on home page', async ({ page }) => {
    await page.goto('/');
    // Tab from body focuses the first focusable element
    await page.keyboard.press('Tab');
    const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['A', 'BUTTON', 'INPUT', 'SELECT']).toContain(firstFocused);
  });

  test('Enter activates a focused link', async ({ page }) => {
    await page.goto('/');
    // Focus the first project link directly
    await page.locator('.icon-grid .finder-icon').first().focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/projects\/[\w-]+\//);
    expect(page.url()).toMatch(/\/projects\/[\w-]+\//);
  });

  test('menubar links reachable via keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    // Tab until focused element is an anchor in the menubar
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tag: el?.tagName,
          inMenubar: !!el?.closest('.site-menubar'),
          href: el?.getAttribute('href'),
        };
      });
      if (focused.inMenubar && focused.tag === 'A' && focused.href) {
        expect(focused.href).toBeTruthy();
        return;
      }
    }
    // If we never find a menubar link, fail
    throw new Error('Could not reach a menubar link via Tab key');
  });

  test('skip link is present for keyboard users', async ({ page }) => {
    await page.goto('/');
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeAttached();
  });
});
