import { test, expect } from '@playwright/test';

test.describe('Classifier app shell', () => {
  test.beforeEach(async ({ page }) => {
    // Block backend connections so the shell can render without a running server
    await page.route('**/api/**', (route) => route.abort());
    await page.route('**/health', (route) => route.abort());
  });

  test('loads app container and all major regions', async ({ page }) => {
    await page.goto('/projects/ai-ml/app/');
    await expect(page.locator('#classifier-app')).toBeVisible();
    await expect(page.locator('.app-navbar')).toBeVisible();
    await expect(page.locator('#log-drawer')).toBeVisible();
  });

  test('renders ClassifierTrainCard with train button', async ({ page }) => {
    await page.goto('/projects/ai-ml/app/');
    await expect(page.locator('#train-btn')).toBeVisible();
    await expect(page.locator('#model-type')).toBeAttached();
    await expect(page.locator('#model-name')).toBeAttached();
  });

  test('renders ClassifierModelsCard regions', async ({ page }) => {
    await page.goto('/projects/ai-ml/app/');
    await expect(page.locator('#session-models')).toBeAttached();
    await expect(page.locator('#saved-select')).toBeAttached();
    await expect(page.locator('#import-btn')).toBeAttached();
  });

  test('renders ClassifierResultsPanel regions', async ({ page }) => {
    await page.goto('/projects/ai-ml/app/');
    await expect(page.locator('#pred-body')).toBeAttached();
    await expect(page.locator('#metrics-head')).toBeAttached();
    await expect(page.locator('#metrics-body')).toBeAttached();
  });

  test('dataset dropdown button is focusable', async ({ page }) => {
    await page.goto('/projects/ai-ml/app/');
    const btn = page.locator('#dataset-menu-btn');
    await expect(btn).toBeVisible();
    await btn.focus();
    await expect(btn).toBeFocused();
  });
});

// Offline, the backend-only controls say so instead of failing, a blank canvas
// predicts nothing, and the two-class QSVM says it's two-class.
test.describe('Classifier: the browser tier is honest about what it can do', () => {
  test('backend-only controls are disabled with the reason shown', async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.goto('/projects/ai-ml/app/');
    await expect(page.locator('#backend-note')).toBeVisible();
    await expect(page.locator('#train-btn')).toBeDisabled();
    await expect(page.locator('#ensemble-btn')).toBeDisabled();
    await expect(page.locator('#model-type-row')).toBeHidden();
  });

  test('a blank canvas predicts nothing; a drawing gets a scoped QSVM row', async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.goto('/projects/ai-ml/app/');
    // The in-browser models load after hydration; draw only once they're listed.
    await expect(page.locator('.pred-model-name').filter({ hasText: 'QSVM' })).toBeVisible();
    await page.locator('#predict-btn').click();
    await expect(page.locator('#pred-body')).toContainText('Draw a digit');
    const cv = page.locator('#draw-canvas');
    const b = (await cv.boundingBox())!;
    await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.22);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * 0.7, b.y + b.height * 0.22, { steps: 20 });
    await page.mouse.move(b.x + b.width * 0.45, b.y + b.height * 0.8, { steps: 20 });
    await page.mouse.up();
    const rows = page.locator('.pred-model-name');
    await expect(rows.filter({ hasText: 'QSVM' })).toContainText('6 vs 9 only');
    await expect(page.locator('.pred-label').first()).toHaveText('7');
    await expect(page.locator('.pred-out-note')).toContainText('only answers 6 vs 9');
  });
});
