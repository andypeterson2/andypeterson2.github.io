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
  });

  test('renders ClassifierTrainCard with train button', async ({ page }) => {
    await page.goto('/projects/ai-ml/app/');
    // Offline the form is folded under its title; opening it shows the button.
    await expect(page.locator('#train-btn')).toBeHidden();
    await page.locator('#train-form > summary').click();
    await expect(page.locator('#train-btn')).toBeVisible();
    await expect(page.locator('#model-type')).toBeAttached();
    await expect(page.locator('#model-name')).toBeAttached();
  });

  test('renders ClassifierModelsCard regions', async ({ page }) => {
    await page.goto('/projects/ai-ml/app/');
    await expect(page.locator('#saved-select')).toBeAttached();
    await expect(page.locator('#import-btn')).toBeAttached();
  });

  test('renders ClassifierResultsPanel regions', async ({ page }) => {
    await page.goto('/projects/ai-ml/app/');
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
// predicts nothing, and a model that knows fewer classes than the dataset says so.
test.describe('Classifier: the browser tier is honest about what it can do', () => {
  test('backend-only controls are folded and disabled, with the reason shown', async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.goto('/projects/ai-ml/app/');
    await expect(page.locator('#backend-note')).toHaveText('needs the live backend');
    await expect(page.locator('#train-form')).not.toHaveAttribute('open', '');
    await page.locator('#train-form > summary').click();
    await expect(page.locator('#train-btn')).toBeDisabled();
    await expect(page.locator('#epochs')).toBeDisabled();
    await expect(page.locator('#ensemble-btn')).toBeDisabled();
    await expect(page.locator('#model-type-row')).toBeHidden();
    await expect(page.locator('#saved-card')).toBeHidden();
  });

  test('every model is a column, and the demo models carry no tier suffix', async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.goto('/projects/ai-ml/app/');
    await expect(page.locator('#metrics-body .col-model-name')).toHaveText([
      'Logistic Regression',
      'QSVM (6 vs 9)',
    ]);
    await expect(page.locator('#tier-label')).toHaveCount(0);
  });

  test('Evaluation shows only columns with a value', async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.goto('/projects/ai-ml/app/');
    await expect(page.locator('#metrics-body .col-model-name')).toHaveCount(2);
    // Now is drawn before a stroke lands; the rest earn their columns.
    await expect(page.locator('#metrics-head .metric-label')).toHaveText([
      'Prediction',
      'Score',
      'Type',
      'Params',
      'Reads',
      'Test Acc',
    ]);
  });

  test('Iris takes a slider or an exact value, and re-scores as they move', async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.goto('/projects/ai-ml/app/');
    await expect(page.locator('#metrics-body .col-model-name').nth(1)).toHaveText('QSVM (6 vs 9)');
    await page.locator('#dataset-menu-btn').click();
    await page.locator('.ui-dropdown-item', { hasText: 'Iris' }).click();
    await expect(page.locator('.feature-label').first()).toContainText('Sepal length');
    await expect(page.locator('.feature-hint').first()).toHaveText('4.3 – 8.0 cm');
    const answer = page
      .locator('#metrics-body td[data-metric="Prediction"]')
      .first()
      .locator('.pred-label');
    await page.locator('#feature-petal_length').fill('1.3');
    await expect(answer).toHaveText('setosa');
    // The slider and the exact-value box are two views of one number.
    await page.locator('.feature-range').nth(2).fill('5.9');
    await expect(page.locator('#feature-petal_length')).toHaveValue('5.9');
    await expect(answer).toHaveText('virginica');
    await page.locator('#reset-features-btn').click();
    await expect(page.locator('#feature-petal_length')).toHaveValue('4.0');
  });

  test('Iris carries both QSVM rules, and only one of them reads every slider', async ({
    page,
  }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.goto('/projects/ai-ml/app/');
    await expect(page.locator('#metrics-body .col-model-name').nth(1)).toHaveText('QSVM (6 vs 9)');
    await page.locator('#dataset-menu-btn').click();
    await page.locator('.ui-dropdown-item', { hasText: 'Iris' }).click();
    await expect(page.locator('#metrics-body .col-model-name')).toHaveText([
      'Logistic Regression',
      'QSVM (setosa vs versicolor)',
      'QSVM one-vs-one (3 species)',
    ]);
    // The paper's rule takes two of the four measurements; the one-vs-one rule
    // takes all four, and the Reads column is where that is stated.
    const reads = page.locator('#metrics-body td[data-metric="Reads"]');
    await expect(reads.nth(1)).toHaveText('sepal_width, petal_length');
    await expect(reads.nth(2)).toHaveText(
      'sepal_length, sepal_width, petal_length, petal_width',
    );

    // sepal_length is one of the two the paper's rule ignores. Moving it must
    // move the one-vs-one score and leave the binary one where it was.
    const score = page.locator('#metrics-body td[data-metric="Score"]');
    const binaryBefore = await score.nth(1).innerText();
    const ovoBefore = await score.nth(2).innerText();
    await page.locator('#feature-sepal_length').fill('7.8');
    await expect(score.nth(2)).not.toHaveText(ovoBefore);
    await expect(score.nth(1)).toHaveText(binaryBefore);

    // Three species, so the third is reachable — no binary rule here can say it.
    await page.locator('#feature-petal_width').fill('2.4');
    await page.locator('#feature-petal_length').fill('5.8');
    const answer = page.locator('#metrics-body td[data-metric="Prediction"]').nth(2);
    await expect(answer).toHaveText('virginica');
    await expect(score.nth(2)).toHaveAttribute('title', /^Vote \d of 3 for virginica\./);
  });

  test('a blank canvas predicts nothing; the QSVM names the classes it knows', async ({
    page,
  }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.goto('/projects/ai-ml/app/');
    // The in-browser models load after hydration; draw only once they're listed.
    await expect(page.locator('#metrics-body .col-model-name').nth(1)).toHaveText('QSVM (6 vs 9)');
    // Nothing to press: a stroke is what asks for a prediction. Until one lands
    // the live rows are drawn and empty.
    const prediction = page.locator('#metrics-body td[data-metric="Prediction"]');
    await expect(prediction).toHaveCount(2);
    await expect(prediction.first()).toHaveText('—');
    const cv = page.locator('#draw-canvas');
    const b = (await cv.boundingBox())!;
    await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.22);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * 0.7, b.y + b.height * 0.22, { steps: 20 });
    await page.mouse.move(b.x + b.width * 0.45, b.y + b.height * 0.8, { steps: 20 });
    await page.mouse.up();
    await expect(page.locator('.pred-label').first()).toHaveText('7');
    // An answer outside the pair it knows is struck through; which pair that is
    // belongs to the model, so it is in its name rather than beside the answer.
    await expect(page.locator('.pred-label.pred-out')).toHaveCount(1);
  });
});

test.describe('Classifier: what the models see and say', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.goto('/projects/ai-ml/app/');
    await expect(page.locator('#metrics-body .col-model-name').nth(1)).toHaveText('QSVM (6 vs 9)');
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

  test('the QSVM score is how far it leans, drawn out from the boundary', async ({ page }) => {
    await drawSeven(page);
    // QSVM is the second model, so its score is the second cell of that column.
    const score = page.locator('#metrics-body td[data-metric="Score"]').nth(1);
    await expect(score).toContainText(/^\d+\.\d%$/);
    // The bar is the diverging one, and the raw margin is what the hover says.
    await expect(score.locator('.score-bar--lean')).toBeVisible();
    await expect(score).toHaveAttribute('title', /^Margin -?\d\.\d{3}, .* of the evidence/);
  });

  test('a linear model fills its score bar from the left, not the middle', async ({ page }) => {
    await drawSeven(page);
    const score = page.locator('#metrics-body td[data-metric="Score"]').first();
    await expect(score).toContainText(/^\d+\.\d%$/);
    await expect(score.locator('.score-bar')).toBeVisible();
    await expect(score.locator('.score-bar--lean')).toHaveCount(0);
  });

  test('a label with more to say marks itself and says it on hover', async ({ page }) => {
    const score = page.locator('#metrics-head th[data-metric="Score"]');
    await expect(score).toHaveAttribute('title', /softmax of the top class/);
    // The dotted underline is what tells a reader there is something to hover.
    await expect(score).toHaveClass(/has-note/);
  });
});

test.describe('Classifier: every stroke gets scored', () => {
  test('a stroke that runs off the pad is scored when it leaves', async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.goto('/projects/ai-ml/app/');
    await expect(page.locator('#metrics-body .col-model-name').nth(1)).toHaveText('QSVM (6 vs 9)');
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
