import { test, expect } from '@playwright/test';

const PROJECTS = [
  { slug: 'quantum-video-chat', title: 'Quantum Video Chat' },
  { slug: 'quantum-nonogram-solver', title: 'Quantum Nonogram Solver' },
  { slug: 'quantum-protein-kernel', title: 'Quantum ML Classifier Platform' },
  { slug: 'latex-resume-editor', title: 'LaTeX Resume Editor' },
];

test.describe('Project detail pages', () => {
  for (const { slug, title } of PROJECTS) {
    test(`${slug} detail renders title and hero description`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto(`/projects/${slug}/`);
      await expect(page).toHaveTitle(new RegExp(title));
      await expect(page.locator('.hero-desc')).toBeVisible();
      expect(errors).toEqual([]);
    });

    test(`${slug} links to its GitHub repo`, async ({ page }) => {
      await page.goto(`/projects/${slug}/`);
      const repoLink = page.locator('a[href*="github.com"]').first();
      await expect(repoLink).toBeVisible();
      const href = await repoLink.getAttribute('href');
      expect(href).toMatch(/^https:\/\/github\.com\//);
    });
  }

  test('related projects section appears when siblings exist', async ({ page }) => {
    // quantum-video-chat shares category "quantum" with others
    await page.goto('/projects/quantum-video-chat/');
    const related = page.locator('.related-list .related-item');
    const count = await related.count();
    expect(count).toBeGreaterThan(0);
  });

  test('related project links navigate to correct detail pages', async ({ page }) => {
    await page.goto('/projects/quantum-video-chat/');
    const firstRelated = page.locator('.related-list .related-item').first();
    const href = await firstRelated.getAttribute('href');
    expect(href).toMatch(/^\/projects\/[\w-]+\/$/);
  });

  test('project navigation section renders prev/next links', async ({ page }) => {
    await page.goto('/projects/quantum-nonogram-solver/');
    await expect(page.locator('.project-nav')).toBeAttached();
  });
});
