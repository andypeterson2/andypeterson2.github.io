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
    // .action-btn is now the "The longer version" writeup button).
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

  // The page scrolls inside .site-pane, and PageDown and Space must reach it before any
  // click. The first Tab must still land on the skip link.
  test('PageDown and Space scroll the page before any click', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    const top = () => page.evaluate(() => document.querySelector('.site-pane')!.scrollTop);
    expect(await top()).toBe(0);
    await page.keyboard.press('PageDown');
    await expect.poll(top).toBeGreaterThan(300);
    const after = await top();
    await page.keyboard.press(' ');
    await expect.poll(top).toBeGreaterThan(after);
    await page.keyboard.press('Home');
    await expect.poll(top).toBe(0);
  });

  test('the first Tab still reaches the skip link', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.locator('a.skip-link')).toBeFocused();
  });

  test('skip link is present for keyboard users', async ({ page }) => {
    await page.goto('/');
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeAttached();
  });
});

// A focused field must still show what's typed into it: system.css inverts focused
// inputs, and a local "paper" ground must not leave them white on white.
test.describe('Focused inputs keep their text visible', () => {
  const cases = [
    // The Train form is folded and disabled offline: open it and enable it to type.
    { path: '/projects/ai-ml/app/', selector: '#epochs', unfold: '#train-form' },
    { path: '/projects/quantum-nonogram-solver/app/', selector: '#threshold-input' },
  ];
  for (const { path, selector, unfold } of cases) {
    test(`${selector} on ${path}`, async ({ page }) => {
      await page.goto(path);
      if (unfold) {
        await page.locator(unfold).evaluate((el) => {
          (el as HTMLDetailsElement).open = true;
          el.querySelector('fieldset')?.removeAttribute('disabled');
        });
      }
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
