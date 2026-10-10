import { test, expect } from '@playwright/test';

// /projects is a Finder-style grid, and each icon opens that project's own page.
// The /app/ demo pages live one level below and are reached from there.
const SLUGS = [
  'quantum-video-chat',
  'quantum-nonogram-solver',
  'quantum-ml-classifier',
  'latex-resume-editor',
  'tiny-skill-linker',
];

test.describe('Project pages', () => {
  test('the grid lists every project and links to its page', async ({ page }) => {
    await page.goto('/projects/');
    const icons = page.locator('.finder-icon');
    await expect(icons).toHaveCount(SLUGS.length);
    for (const slug of SLUGS) {
      await expect(page.locator(`.finder-icon[href="/projects/${slug}/"]`)).toBeVisible();
    }
  });

  for (const slug of SLUGS) {
    test(`/projects/${slug}/ is its own page`, async ({ page }) => {
      await page.goto(`/projects/${slug}/`);
      await expect(page).toHaveURL(new RegExp(`/projects/${slug}/$`));
      await expect(page.locator('.project-title')).toBeVisible();
      await expect(page.locator('.project-actions a[href]').first()).toBeVisible();
    });
  }

  test('an icon opens the project page', async ({ page }) => {
    await page.goto('/projects/');
    await page.locator('.finder-icon').first().click();
    await expect(page).toHaveURL(/\/projects\/[\w-]+\/$/);
    await expect(page.locator('.project-title')).toBeVisible();
  });

  test('the /app/ demo pages survive below the project pages', async ({ page }) => {
    await page.goto('/projects/ai-ml/app/');
    await expect(page).toHaveURL(/\/projects\/ai-ml\/app\/$/);
    await expect(page.locator('#classifier-app')).toBeAttached();
  });
});
