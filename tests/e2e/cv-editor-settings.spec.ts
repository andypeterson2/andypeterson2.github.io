import { test, expect } from '@playwright/test';

/**
 * Verify the LaTeX resume editor exposes a Settings tab that contains
 * the File actions and View toggles, and that the site menubar no
 * longer has the injected File/View nav items.
 */

test.describe('CV editor Settings tab', () => {
  test.beforeEach(async ({ page }) => {
    // Block backend so the shell renders without a running CV server
    await page.route('**/api/**', (route) => route.abort());
    await page.route('**/health', (route) => route.abort());
  });

  test('site menubar does not contain injected File/View nav items', async ({ page }) => {
    await page.goto('/projects/latex-resume-editor/app/');
    await expect(page.locator('.cv-file-nav')).toHaveCount(0);
    await expect(page.locator('.cv-view-nav')).toHaveCount(0);
  });

  test('editor tab bar includes a Settings tab', async ({ page }) => {
    await page.goto('/projects/latex-resume-editor/app/');
    const settingsTab = page.locator('.cv-editor-tab', { hasText: 'Settings' });
    await expect(settingsTab).toBeVisible();
  });

  test('Settings tab shows Document, Save & Export, Compile, and View sections', async ({
    page,
  }) => {
    await page.goto('/projects/latex-resume-editor/app/');
    await page.locator('.cv-editor-tab', { hasText: 'Settings' }).click();

    const settings = page.locator('.cv-settings-editor');
    await expect(settings).toBeVisible();
    await expect(settings.locator('.cv-settings-heading', { hasText: 'Document' })).toBeVisible();
    await expect(
      settings.locator('.cv-settings-heading', { hasText: 'Save & Export' }),
    ).toBeVisible();
    await expect(settings.locator('.cv-settings-heading', { hasText: 'Compile' })).toBeVisible();
    await expect(settings.locator('.cv-settings-heading', { hasText: 'View' })).toBeVisible();
  });

  test('Settings tab exposes all File actions as buttons', async ({ page }) => {
    await page.goto('/projects/latex-resume-editor/app/');
    await page.locator('.cv-editor-tab', { hasText: 'Settings' }).click();

    const settings = page.locator('.cv-settings-editor');
    for (const label of [
      'New',
      'Open',
      'Rename',
      'Save',
      'Export JSON',
      'Import JSON',
      'Compile PDF',
    ]) {
      await expect(settings.locator('button', { hasText: label })).toBeAttached();
    }
  });

  test('Settings tab View section uses a radio group', async ({ page }) => {
    await page.goto('/projects/latex-resume-editor/app/');
    await page.locator('.cv-editor-tab', { hasText: 'Settings' }).click();

    const radioGroup = page.locator('.cv-settings-radio-group[role="radiogroup"]');
    await expect(radioGroup).toBeVisible();
    await expect(radioGroup.locator('input[type="radio"][value="cv"]')).toBeAttached();
    await expect(radioGroup.locator('input[type="radio"][value="resume"]')).toBeAttached();
    await expect(radioGroup.locator('input[type="radio"][value="coverletter"]')).toBeAttached();
  });

  test('mobile toolbar does not include the File menu button', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/projects/latex-resume-editor/app/');
    await expect(page.locator('.cv-mobile-file-btn')).toHaveCount(0);
    // The view selector stays — it switches editor/PDF panes on mobile
    await expect(page.locator('.cv-mobile-view-select')).toBeAttached();
  });
});
