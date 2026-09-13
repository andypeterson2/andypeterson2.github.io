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
    // Focus the first project link on the timeline directly (the Me card's first
    // .action-btn is now the "The longer version" writeup button, not a link).
    await page.locator('.timeline a.action-btn').first().focus();
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

// A focused field must still show what's typed into it: system.css inverts focused
// inputs, and local "paper" grounds once left them white on white (audit H12).
test.describe('Focused inputs keep their text visible', () => {
  const cases = [
    { path: '/projects/ai-ml/app/', selector: '#epochs' },
    { path: '/projects/quantum-nonogram-solver/app/', selector: '#threshold-input' },
  ];
  for (const { path, selector } of cases) {
    test(`${selector} on ${path}`, async ({ page }) => {
      await page.goto(path);
      const input = page.locator(selector);
      await input.evaluate((el) => {
        (el as HTMLInputElement).disabled = false;
      });
      await input.click();
      const { color, background } = await input.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { color: cs.color, background: cs.backgroundColor };
      });
      expect(color).not.toBe(background);
    });
  }
});
