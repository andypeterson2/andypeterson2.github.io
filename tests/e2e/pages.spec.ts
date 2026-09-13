import { test, expect } from '@playwright/test';

test.describe('Core pages render without errors', () => {
  // Titles name the person: "Name — Job title" on home (audit M5).
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
    // Section labels are the credential windows' title-bar headings (Education,
    // Certs, Skills). They sit in the row after the timeline (.more-cols) since the
    // layout pass that put the work ahead of them (audit H3/M4).
    const sections = page.locator('.more-cols .sidebar-window .title-bar .title');
    const count = await sections.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  // The long About opens from the Me card, and /about lands on it (H5).
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
