import { test, expect } from '@playwright/test';

test.describe('Core pages render without errors', () => {
  const pages = [{ path: '/', title: /Home/ }];

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
    // Section labels are the left-column window title-bar headings (Education,
    // Certs, Skills). They live under .main-left since the home page was
    // refactored into components (was .about-grid).
    const sections = page.locator('.main-left .sidebar-window .title-bar .title');
    const count = await sections.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  // The long-form About section is temporarily hidden (see the .about-window
  // display:none rule in index.astro). Re-enable when it's restored.
  test.skip('has the long-form about section', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#about')).toBeVisible();
    const sections = page.locator('#about .about-section h3');
    expect(await sections.count()).toBeGreaterThanOrEqual(3);
  });

  test('projects appear on the timeline with metrics', async ({ page }) => {
    await page.goto('/');
    const projectEntries = page.locator('.timeline-entry--project');
    expect(await projectEntries.count()).toBeGreaterThanOrEqual(3);
    await expect(projectEntries.first().locator('.tl-metric').first()).toBeVisible();
  });

  test('/about redirects to the home page', async ({ page }) => {
    await page.goto('/about');
    await expect(page).toHaveURL('/');
  });
});
