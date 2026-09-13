import { test, expect } from '@playwright/test';

const APP = '/projects/quantum-nonogram-solver/app/';

test.describe('Nonogram: results always describe the puzzle on screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.goto(APP);
    await expect(page.locator('td.cell').first()).toBeVisible();
  });

  // Audit M22: editing a loaded gallery run used to leave its solutions, histogram,
  // gallery label and "a real run on the Grover simulator" beside a different grid.
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

  // Audit M12: the grid only grew, and Clear kept the size.
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
