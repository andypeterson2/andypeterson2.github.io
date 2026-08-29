import { test, expect } from '@playwright/test';

// The legacy project-detail surface is retired: every old detail URL 301s to
// the project's anchored entry on the home timeline — one surface, one story.
const SLUGS = [
  'quantum-video-chat',
  'quantum-nonogram-solver',
  'quantum-ml-classifier',
  'latex-resume-editor',
];

test.describe('Retired detail pages redirect to the timeline', () => {
  for (const slug of SLUGS) {
    test(`/projects/${slug}/ lands on the anchored timeline entry`, async ({ page }) => {
      await page.goto(`/projects/${slug}/`);
      await expect(page).toHaveURL(new RegExp(`/#${slug}$`));
      await expect(page.locator(`.timeline-entry--project#${slug}`)).toBeVisible();
    });
  }

  test('/projects/ lands on the timeline section', async ({ page }) => {
    await page.goto('/projects/');
    await expect(page).toHaveURL(/\/#projects$/);
    await expect(page.locator('#projects')).toBeVisible();
  });

  test('the /app/ demo pages survive the redirects', async ({ page }) => {
    await page.goto('/projects/quantum-ml-classifier/app/');
    await expect(page).toHaveURL(/\/projects\/quantum-ml-classifier\/app\/$/);
    await expect(page.locator('#classifier-app')).toBeAttached();
  });
});
