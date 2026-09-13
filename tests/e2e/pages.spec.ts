import { test, expect } from '@playwright/test';

test.describe('Core pages render without errors', () => {
  // Titles name the person: "Name — Job title" on home.
  const pages = [{ path: '/', title: / \u2014 / }];

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

test.describe('Project timeline (the one showcase surface)', () => {
  test('lists all projects as timeline entries', async ({ page }) => {
    await page.goto('/');
    const entries = page.locator('.timeline-entry--project');
    await expect(entries.first()).toBeVisible();
    const count = await entries.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('project entries link to their repos', async ({ page }) => {
    await page.goto('/');
    const repoLink = page
      .locator('.timeline-entry--project')
      .first()
      .locator('a[href*="github.com"]')
      .first();
    await expect(repoLink).toBeAttached();
  });
});

// The standalone /about page was folded into the home page; '/about' now
// redirects to '/'. These assert the consolidated content is all still there.
test.describe('Home page about content', () => {
  test('has bio section with name', async ({ page }) => {
    await page.goto('/');
    // Scope to the bio window's own title bar — nested cards also carry .title.
    await expect(page.locator('.bio-window > .title-bar .title')).toBeVisible();
  });

  test('has section labels', async ({ page }) => {
    await page.goto('/');
    // Section labels are the credential windows' title-bar headings (Education, Certs,
    // Skills), in the row after the timeline (.more-cols).
    const sections = page.locator('.more-cols .sidebar-window .title-bar .title');
    const count = await sections.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  // The long About opens from the Me card, and /about lands on it.
  test('the longer version opens from the Me card', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /The longer version/ }).click();
    const dialog = page.getByRole('dialog', { name: 'The longer version' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'The research years' })).toBeVisible();
  });

  test('projects appear on the timeline with metrics', async ({ page }) => {
    await page.goto('/');
    const projectEntries = page.locator('.timeline-entry--project');
    expect(await projectEntries.count()).toBeGreaterThanOrEqual(3);
    await expect(projectEntries.first().locator('.tl-metric').first()).toBeVisible();
  });

  test('/about opens the longer version on the home page', async ({ page }) => {
    await page.goto('/about');
    await expect(page).toHaveURL('/#about');
    await expect(page.getByRole('dialog', { name: 'The longer version' })).toBeVisible();
  });
});

// Every timeline marker sits on the spine: markers measured from a different box than
// the spine land 12px right of the line.
test('timeline markers sit on the spine', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const { spine, markers } = await page.evaluate(() => {
    const tl = document.querySelector('.timeline')!;
    const spineX =
      tl.getBoundingClientRect().left + parseFloat(getComputedStyle(tl, '::before').left);
    const xs = [...document.querySelectorAll('.timeline-entry')].map(
      (e) => e.getBoundingClientRect().left + parseFloat(getComputedStyle(e, '::after').left),
    );
    return { spine: spineX, markers: xs };
  });
  expect(markers.length).toBeGreaterThan(3);
  for (const x of markers) expect(Math.abs(x - spine)).toBeLessThan(1);
});

// System 6 chrome: stripes only on the front window, the default button ringed, and
// nothing but buttons wearing a border.
test.describe('Home: the window chrome says what is in front and what to press', () => {
  const stripes = (page: import('@playwright/test').Page, sel: string) =>
    page
      .locator(sel)
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundImage);

  test('section windows are plain; the page window is striped', async ({ page }) => {
    await page.goto('/');
    expect(await stripes(page, '.site-window > .title-bar')).not.toBe('none');
    for (const bar of await page.locator('.window--inactive > .title-bar').all()) {
      expect(await bar.evaluate((el) => getComputedStyle(el).backgroundImage)).toBe('none');
    }
    await expect(page.locator('.window--inactive')).toHaveCount(7);
  });

  test('an open writeup is the one striped window, and a click outside closes it', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('[data-writeup-open="writeup-about"]').click();
    const dialog = page.locator('#writeup-about');
    await expect(dialog).toBeVisible();
    expect(await stripes(page, '.site-window > .title-bar')).toBe('none');
    expect(await stripes(page, '#writeup-about .writeup-titlebar')).not.toBe('none');
    await page.mouse.click(8, 450);
    await expect(dialog).toBeHidden();
    expect(await stripes(page, '.site-window > .title-bar')).not.toBe('none');
  });

  test('each project card leads with the default button', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('.timeline-entry--project');
    const n = await cards.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const first = cards.nth(i).locator('.tl-actions > *').first();
      await expect(first).toHaveClass(/action-btn--primary/);
    }
    await expect(page.locator('.tl-actions > .action-btn--primary')).toHaveCount(n);
  });

  test('tech and skill names are text, not bordered chips', async ({ page }) => {
    await page.goto('/');
    for (const sel of ['.tl-tag', '.skill-tags .tag']) {
      await expect(page.locator(sel).first()).toHaveCSS('border-top-style', 'none');
    }
  });

  test('Top stays inside the page window', async ({ page }) => {
    await page.goto('/');
    await page.locator('.site-pane').evaluate((el) => (el.scrollTop = el.scrollHeight));
    const top = page.locator('#back-to-top');
    await expect(top).toBeVisible();
    const b = (await top.boundingBox())!;
    const w = (await page.locator('.site-pane').boundingBox())!;
    expect(b.x + b.width).toBeLessThanOrEqual(w.x + w.width);
    expect(b.y + b.height).toBeLessThanOrEqual(w.y + w.height);
  });
});
