import { test, expect } from '@playwright/test';

test.describe('Classifier app shell', () => {
  test.beforeEach(async ({ page }) => {
    // Block backend connections so the shell can render without a running server
    await page.route('**/api/**', (route) => route.abort());
    await page.route('**/health', (route) => route.abort());
  });

  test('loads app container and all major regions', async ({ page }) => {
    await page.goto('/classifiers/');
    await expect(page.locator('#classifier-app')).toBeVisible();
    await expect(page.locator('.app-navbar')).toBeVisible();
    await expect(page.locator('#log-drawer')).toBeVisible();
  });

  test('renders ClassifierTrainCard with train button', async ({ page }) => {
    await page.goto('/classifiers/');
    await expect(page.locator('#train-btn')).toBeVisible();
    await expect(page.locator('#model-type')).toBeAttached();
    await expect(page.locator('#model-name')).toBeAttached();
  });

  test('renders ClassifierModelsCard regions', async ({ page }) => {
    await page.goto('/classifiers/');
    await expect(page.locator('#session-models')).toBeAttached();
    await expect(page.locator('#saved-select')).toBeAttached();
    await expect(page.locator('#import-btn')).toBeAttached();
  });

  test('renders ClassifierResultsPanel regions', async ({ page }) => {
    await page.goto('/classifiers/');
    await expect(page.locator('#pred-body')).toBeAttached();
    await expect(page.locator('#metrics-head')).toBeAttached();
    await expect(page.locator('#metrics-body')).toBeAttached();
  });

  test('dataset dropdown button is focusable', async ({ page }) => {
    await page.goto('/classifiers/');
    const btn = page.locator('#dataset-menu-btn');
    await expect(btn).toBeVisible();
    await btn.focus();
    await expect(btn).toBeFocused();
  });
});
