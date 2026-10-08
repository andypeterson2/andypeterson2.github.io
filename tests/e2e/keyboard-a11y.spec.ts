import { test, expect, type Page } from '@playwright/test';

// What axe can't see: whether each widget works from the keyboard and says the right
// thing.

const EDITOR = '/projects/latex-resume-editor/app/';
const NONOGRAM = '/projects/quantum-nonogram-solver/app/';
const CLASSIFIER = '/projects/ai-ml/app/';

const activeLabel = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return el?.getAttribute('aria-label') ?? el?.textContent?.trim() ?? '';
  });

// A writeup opens with focus on its text, so the keyboard can scroll to its last
// section. On a phone every writeup overflows.
test.describe('Writeups scroll from the keyboard', () => {
  test('each writeup opens on its text, and PageDown scrolls it', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const triggers = page.locator('[data-writeup-open]');
    const count = await triggers.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const trigger = triggers.nth(i);
      await trigger.scrollIntoViewIfNeeded();
      await trigger.focus();
      await page.keyboard.press('Enter');
      const content = page.locator('[data-writeup-modal]:not([hidden]) .writeup-content');
      await expect(content).toBeFocused();
      await page.keyboard.press('PageDown');
      await expect.poll(() => content.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
    }
  });
});

// Panels keep Tab out of the covered page, and closing hands focus back.
test.describe('Editor panels are modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.goto(EDITOR);
    await expect(page.locator('[data-hydrated]')).toBeAttached();
  });

  test('a drawer takes focus, keeps Tab inside, and hands focus back', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Tags', exact: true }).first();
    await trigger.focus();
    await page.keyboard.press('Enter');
    const drawer = page.getByRole('dialog', { name: 'Tags' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Close' })).toBeFocused();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const where = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.closest('.drawer') ? 'drawer' : (el?.outerHTML.slice(0, 120) ?? 'none');
      });
      expect(where).toBe('drawer');
    }
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});

// Every entry is an open editor, so each one says what it is and labels its fields.
test.describe('The editor to a screen reader', () => {
  test('each entry editor names itself and labels every field', async ({ page }) => {
    await page.goto(EDITOR);
    const editors = page.locator('.doc .edit[data-sortable]');
    await expect(editors.first()).toBeVisible();

    // Each entry is a named group, so its controls are told apart by what they act on.
    const names = await editors.evaluateAll((els) =>
      els.map((e) => e.getAttribute('aria-label') ?? ''),
    );
    expect(names.length).toBeGreaterThan(3);
    for (const n of names) {
      expect(n.trim().length).toBeGreaterThan(0);
      expect(n.length).toBeLessThan(120);
    }
    // Names distinguish: a reader hearing "Delete X" knows which X.
    expect(new Set(names).size).toBe(names.length);
    await expect(editors.first().getByRole('button', { name: `Delete ${names[0]}` })).toBeVisible();

    // No field anywhere in the document is left for a screen reader to guess at.
    const unlabelled = await page
      .locator('.doc .edit input, .doc .edit textarea')
      .evaluateAll((els) =>
        els
          .filter((e) => {
            const own = e.getAttribute('aria-label')?.trim();
            const lbl = e.closest('label')?.querySelector('.lbl')?.textContent?.trim();
            return !own && !lbl;
          })
          .map((e) => e.className),
      );
    expect(unlabelled).toEqual([]);
  });
});

// The grid can be drawn from the keyboard and exposes each cell's state.
test.describe('Nonogram grid by keyboard', () => {
  test('Tab reaches the grid, arrows move, Space fills', async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.goto(NONOGRAM);
    await expect(page.getByRole('table', { name: 'Puzzle grid, 3 by 3' })).toBeVisible();
    // The page opens on a captured run; this one walks an empty grid.
    await page.locator('#btn-clear').click();
    // The size is typed in the grid's own corner, so those two fields lead the cells.
    await page.locator('#size-cols').focus();
    await page.keyboard.press('Tab');
    expect(await activeLabel(page)).toBe('Row 1, column 1');
    await page.keyboard.press('Space');
    const first = page.getByRole('button', { name: 'Row 1, column 1' });
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('ArrowRight');
    expect(await activeLabel(page)).toBe('Row 1, column 2');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Row 1, column 2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('rowheader', { name: 'Row 1 clue: 2' })).toBeVisible();
    // One cell in the tab order at a time: Tab leaves the grid, for the controls that
    // run the board rather than edit it.
    await page.keyboard.press('Tab');
    await expect(page.locator('#btn-where-local')).toBeFocused();
  });
});

// The dataset control names the loaded dataset and is a disclosure.
test.describe('Classifier dataset control', () => {
  test('names the loaded dataset and works as a disclosure', async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.route('**/health', (r) => r.abort());
    await page.goto(CLASSIFIER);
    const trigger = page.locator('#dataset-menu-btn');
    await expect(trigger).toHaveAccessibleName('Dataset: MNIST');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const current = page.locator('#dataset-list [aria-current="true"]');
    await expect(current).toHaveText(/MNIST/);
    await page.getByRole('button', { name: /Iris/ }).click();
    await expect(trigger).toHaveAccessibleName('Dataset: Iris');
    await expect(page.locator('#log-handle')).toHaveAccessibleName('Log');
  });
});

// The shared chrome.
test.describe('Site chrome', () => {
  test('Back to top is out of the tab order until it shows', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('#back-to-top');
    await expect(btn).toBeHidden();
    await page.evaluate(() => {
      const pane = document.querySelector('.site-pane');
      if (pane) pane.scrollTop = 1200;
    });
    await expect(btn).toBeVisible();
  });

  test('the phone theme control is named by its text and shows its state', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.locator('.mobile-nav-btn').click();
    const toggle = page.locator('#mobile-nav-menu').getByRole('button', { name: 'Dark mode' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    const box = await toggle.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('one <main>, and no menu roles on a nav of plain links', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.locator('[role="menubar"], [role="menuitem"]')).toHaveCount(0);
    // It still looks like a System-6 menubar: system.css sets that face only on
    // ul[role], so it's pinned explicitly.
    await expect(page.locator('.site-menubar a[href="/"]')).toHaveCSS(
      'font-family',
      /^"?Chicago_12/,
    );
    await page.goto(CLASSIFIER);
    await expect(page.getByRole('main')).toHaveCount(1);
  });

  test('focus rings are ink, not browser blue', async ({ page }) => {
    await page.goto('/');
    await page.locator('.action-btn').first().focus();
    await page.keyboard.press('Tab'); // keyboard focus, so :focus-visible applies
    const ring = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--ink)';
      document.body.append(probe);
      const ink = getComputedStyle(probe).color;
      probe.remove();
      const cs = getComputedStyle(document.activeElement as HTMLElement);
      return { ink, color: cs.outlineColor, style: cs.outlineStyle };
    });
    expect(ring.style).toBe('solid');
    expect(ring.color).toBe(ring.ink);
  });
});
