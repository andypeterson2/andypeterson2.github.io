import { test, expect } from '@playwright/test';

const APP = '/projects/quantum-nonogram-solver/app/';

test.describe('Nonogram: results always describe the puzzle on screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.goto(APP);
    await expect(page.locator('td.cell').first()).toBeVisible();
  });

  // Editing a loaded gallery run clears its solutions, histogram, gallery label and
  // "a real run on the Grover simulator", which describe a different grid.
  test('editing after a gallery run clears the run', async ({ page }) => {
    await page.locator('#gallery-select').selectOption({ index: 1 });
    await expect(page.locator('#status-line')).toContainText('a real run on');
    await expect(page.locator('#gallery-note')).toBeVisible();

    await page.locator('td.cell').first().dispatchEvent('mousedown');
    await expect(page.locator('#status-line')).toContainText('Edited');
    await expect(page.locator('#gallery-select')).toHaveValue('');
    await expect(page.locator('#gallery-note')).toBeHidden();
    await expect(page.locator('#qu-sol-placeholder')).toContainText('Solve the puzzle');
  });

  test('the grid shrinks, and Clear starts over at 3 × 3', async ({ page }) => {
    const size = page.locator('#grid-size-label');
    await page.getByRole('button', { name: 'Add a row' }).click();
    await page.getByRole('button', { name: 'Add a column' }).click();
    await expect(size).toHaveText('4 × 4');
    await page.getByRole('button', { name: 'Remove a row' }).click();
    await expect(size).toHaveText('3 × 4');
    await page.locator('#btn-clear').click();
    await expect(size).toHaveText('3 × 3');
  });

  test('a grid past the browser limit says what to do', async ({ page }) => {
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Add a row' }).click();
      await page.getByRole('button', { name: 'Add a column' }).click();
    }
    await page.locator('#btn-bench').click();
    await expect(page.locator('#status-line')).toContainText('remove a row or column');
  });
});

// Clues mode: the clues are the puzzle, typed rather than read off a drawing, so a
// clue set with no solution is something the editor can express and the solver answers.
test.describe('Nonogram: typing the clues', () => {
  const clue = (kind: 'row' | 'col', index: number, slot: number) =>
    `input[data-clue-kind="${kind}"][data-clue-index="${String(index)}"]` +
    `[data-clue-slot="${String(slot)}"]`;

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.goto(APP);
    await expect(page.locator('td.cell').first()).toBeVisible();
    await page.locator('#btn-mode-clues').click();
  });

  test('the cells become the unknown and the clues become inputs', async ({ page }) => {
    await expect(page.locator('td.cell')).toHaveCount(0);
    await expect(page.locator('td.cell-unknown')).toHaveCount(9);
    await expect(page.locator('.clue-slot--input')).toHaveCount(6);
    await expect(page.locator('#btn-mode-clues')).toHaveAttribute('aria-pressed', 'true');
  });

  test('a clue set with no solution is reported as such', async ({ page }) => {
    // Every row full but every column holding one cell: the counts cannot agree.
    for (let r = 0; r < 3; r++) await page.locator(clue('row', r, 0)).fill('3');
    for (let c = 0; c < 3; c++) await page.locator(clue('col', c, 0)).fill('1');
    await page.locator('#btn-bench').click();
    await expect(page.locator('#cl-placeholder')).toContainText('No solutions found');
  });

  test('typing a run opens the next slot, and a solvable set solves', async ({ page }) => {
    // One slot each until a clue needs two.
    await expect(page.locator(clue('row', 0, 1))).toHaveCount(0);
    for (let r = 0; r < 3; r++) {
      await page.locator(clue('row', r, 0)).fill('1');
      await page.locator(clue('row', r, 1)).fill('1');
    }
    await page.locator(clue('col', 0, 0)).fill('3');
    await page.locator(clue('col', 2, 0)).fill('3');
    await page.locator('#btn-bench').click();
    // Counted in the metrics table; the sections carry their own timings.
    await expect(
      page.locator('#metrics-pane tr', { hasText: 'Solutions found' }).locator('td').nth(1),
    ).toHaveText('1');
    await expect(page.locator('#cl-canvas .sol-grid-label')).toHaveText('Solution');
  });

  test('going back to Draw hands the clues to the grid again', async ({ page }) => {
    await page.locator(clue('row', 0, 0)).fill('3');
    await page.locator('#btn-mode-draw').click();
    await expect(page.locator('.clue-slot--input')).toHaveCount(0);
    await expect(page.locator('td.cell')).toHaveCount(9);
    await expect(page.locator('#status-line')).toContainText('clues follow the grid');
  });
});

// The browser tier runs Grover's amplitudes as well as the classical search, so the
// Quantum panel answers without a backend — and says only what a simulation can.
test.describe('Nonogram: the quantum half runs in the browser', () => {
  const metric = (page: import('@playwright/test').Page, name: string) =>
    page.locator('#metrics-pane tr', { hasText: name }).locator('td').nth(2);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.goto(APP);
    await expect(page.locator('td.cell').first()).toBeVisible();
  });

  test('a solved puzzle fills the histogram and the Grover metrics', async ({ page }) => {
    for (const i of [0, 1, 2, 3]) await page.locator('.cell-btn').nth(i).click();
    await page.locator('#btn-bench').click();

    // Each figure annotates the section it measures rather than piling into one line.
    await expect(page.locator('#cl-meta')).toHaveText(/ms$/);
    await expect(page.locator('#qu-meta')).toContainText('noiseless');
    await expect(page.locator('#hist-meta')).toHaveText('1024 shots');
    await expect(page.locator('#hist-meta')).toHaveAttribute('title', /1024 shots/);
    // Nothing restated underneath.
    await expect(page.locator('#status-line')).toBeHidden();

    await expect(page.locator('#qu-histogram rect.hist-bar').first()).toBeVisible();
    await expect(metric(page, 'Qubits')).toHaveText('9');
    await expect(metric(page, 'Grover iterations')).not.toHaveText('—');
    await expect(metric(page, 'Top probability')).toContainText('%');
    // There is no circuit, so there is no depth and no quantum solve time to give.
    await expect(metric(page, 'Circuit depth')).toHaveText('—');
    await expect(metric(page, 'Solve time')).toHaveText('—');
  });

  test('the quantum solution matches the classical one', async ({ page }) => {
    // An asymmetric grid: a mirrored reading would show a different picture.
    for (const i of [0, 1, 2, 3]) await page.locator('.cell-btn').nth(i).click();
    await page.locator('#btn-bench').click();
    await expect(page.locator('#qu-list .sol-table')).toHaveCount(1);

    const cells = (root: string) =>
      page
        .locator(`${root} .sol-table td`)
        .evaluateAll((tds) => tds.map((td) => td.className).join(''));
    expect(await cells('#qu-list')).toBe(await cells('#cl-canvas'));
  });

  test('clues with no solution amplify nothing, and say so', async ({ page }) => {
    await page.locator('#btn-mode-clues').click();
    for (let r = 0; r < 3; r++) {
      await page
        .locator(`input[data-clue-kind="row"][data-clue-index="${String(r)}"]`)
        .first()
        .fill('3');
    }
    for (let c = 0; c < 3; c++) {
      await page
        .locator(`input[data-clue-kind="col"][data-clue-index="${String(c)}"]`)
        .first()
        .fill('1');
    }
    await page.locator('#btn-bench').click();
    await expect(page.locator('#cl-placeholder')).toContainText('No solutions found');
    // A sampled draw would put a few states over the line by luck; a flat
    // distribution puts none, which is what no solution means.
    await expect(page.locator('#qu-sol-placeholder')).toContainText('No solutions above threshold');
    await expect(metric(page, 'Grover iterations')).toHaveText('0');
  });
});
