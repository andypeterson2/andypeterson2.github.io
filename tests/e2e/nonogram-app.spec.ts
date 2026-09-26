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
    await expect(page.locator('#status-line')).toContainText('0 solutions');
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
    await expect(page.locator('#status-line')).toContainText('1 solution');
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
