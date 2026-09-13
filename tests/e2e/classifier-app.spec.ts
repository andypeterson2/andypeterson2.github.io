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

test.describe('Classifier: what the models see and say', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.goto('/projects/ai-ml/app/');
    await expect(page.locator('.pred-model-name').filter({ hasText: 'QSVM' })).toBeVisible();
  });

  async function drawSeven(page: import('@playwright/test').Page) {
    const b = (await page.locator('#draw-canvas').boundingBox())!;
    await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.22);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * 0.7, b.y + b.height * 0.22, { steps: 20 });
    await page.mouse.move(b.x + b.width * 0.45, b.y + b.height * 0.8, { steps: 20 });
    await page.mouse.up();
  }

  test('the canvas bitmap holds the digit only; the cell lines are an overlay', async ({
    page,
  }) => {
    await drawSeven(page);
    await expect(page.locator('.pred-label').first()).toHaveText('7');
    // x = 10 is a cell boundary; the bottom-left corner holds no ink, so no grey line.
    const px = await page.evaluate(() => {
      const c = document.getElementById('draw-canvas') as HTMLCanvasElement;
      return Array.from(c.getContext('2d')!.getImageData(10, 270, 1, 1).data).slice(0, 3);
    });
    expect(px).toEqual([0, 0, 0]);
    await expect(page.locator('.draw-grid')).toHaveCSS('pointer-events', 'none');
  });

  test('a canvas handed back blank is repainted from the drawing', async ({ page }) => {
    await drawSeven(page);
    await expect(page.locator('.pred-label').first()).toHaveText('7');
    const inked = () =>
      page.evaluate(() => {
        const c = document.getElementById('draw-canvas') as HTMLCanvasElement;
        const d = c.getContext('2d')!.getImageData(0, 0, 280, 280).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if ((d[i] ?? 0) > 0) n++;
        return n;
      });
    const before = await inked();
    await page.evaluate(() => {
      const c = document.getElementById('draw-canvas') as HTMLCanvasElement;
      c.getContext('2d')!.clearRect(0, 0, 280, 280);
      c.dispatchEvent(new Event('contextrestored'));
    });
    expect(await inked()).toBe(before);
  });

  test('the preprocessed digit is shown as the model sees it', async ({ page }) => {
    await drawSeven(page);
    await expect(page.locator('.pred-label').first()).toHaveText('7');
    const ink = await page.evaluate(() => {
      const c = document.getElementById('seen-canvas') as HTMLCanvasElement;
      return c
        .getContext('2d')!
        .getImageData(0, 0, 28, 28)
        .data.filter((_, i) => i % 4 === 0)
        .reduce((a, v) => a + v, 0);
    });
    expect(ink).toBeGreaterThan(0);
  });

  test('the QSVM row shows its margin and features, not a percentage', async ({ page }) => {
    await drawSeven(page);
    const qsvm = page.locator('#pred-body tr').filter({ hasText: 'QSVM' });
    await expect(qsvm.locator('td').nth(2)).toContainText(/^s [+-]\d+\.\d\d \(f1 /);
    await expect(page.locator('#pred-body').locator('..').locator('th').nth(2)).toHaveText('Score');
  });

  test('the log narrates the demo, and opening it shows more of it', async ({ page }) => {
    const log = page.locator('#log-terminal');
    await expect(log).toContainText('weights loaded');
    await drawSeven(page);
    await expect(log).toContainText('predict:');
    await page.locator('#clear-btn').click();
    await expect(log).toContainText('canvas cleared');
    const closed = (await log.boundingBox())!.height;
    await page.locator('#log-handle').click();
    await expect(page.locator('#log-handle')).toHaveAttribute('aria-expanded', 'true');
    const open = (await log.boundingBox())!.height;
    expect(open).toBeGreaterThan(closed * 2);
  });

  test('in-browser models say which export their weights came from', async ({ page }) => {
    await expect(page.locator('#session-models')).toContainText(/weights · [0-9a-f]{7} · \d{4}-/);
  });
});

test.describe('Classifier: every stroke gets scored', () => {
  test('a stroke that runs off the pad is scored when it leaves', async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.goto('/projects/ai-ml/app/');
    await expect(page.locator('.pred-model-name').filter({ hasText: 'QSVM' })).toBeVisible();
    const b = (await page.locator('#draw-canvas').boundingBox())!;
    await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.8, { steps: 15 });
    await page.mouse.move(b.x + b.width * 0.5, b.y + b.height + 40, { steps: 5 });
    await expect(page.locator('.pred-label').first()).not.toHaveText('');
    await page.mouse.up();
  });

  test('a digit drawn before the weights arrive is scored when they do', async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.route('**/classifiers/models/*.json', async (r) => {
      await new Promise((res) => setTimeout(res, 1500));
      await r.continue();
    });
    await page.goto('/projects/ai-ml/app/');
    await expect(page.locator('.pred-model-name')).toHaveCount(0);
    const b = (await page.locator('#draw-canvas').boundingBox())!;
    await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.8, { steps: 15 });
    await page.mouse.up();
    await expect(page.locator('.pred-label').first()).not.toHaveText('', { timeout: 10_000 });
  });
});
