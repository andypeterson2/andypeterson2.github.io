import { test, expect } from '@playwright/test';

/**
 * The benchmark viewer. Nothing here calls a server, so the only thing that can
 * leave the page empty is the data file; these tests assert it arrives and that
 * both states draw from it.
 */
const APP = '/projects/tiny-skill-linker/app/';

test.describe('Skill linker benchmark viewer', () => {
  test.beforeEach(async ({ page }) => {
    // Nothing should reach a backend. A blocked route proves it rather than assuming it.
    await page.route('**/api/**', (r) => r.abort());
    await page.goto(APP);
  });

  test('the walk opens on a sentence with its answer key', async ({ page }) => {
    await expect(page.locator('#sl-sentence')).not.toBeEmpty();
    await expect(page.locator('#sl-progress')).toContainText('of 338');
    await expect(page.locator('#sl-answer')).toContainText('Correct skills');
    // One list per arm, five candidates each.
    await expect(page.locator('#sl-columns .sl-arm')).toHaveCount(2);
    await expect(page.locator('#sl-columns .sl-arm').first().locator('li')).toHaveCount(5);
  });

  test('the running figures name both models and the whole-set target', async ({ page }) => {
    await expect(page.locator('#sl-running .sl-running-row')).toHaveCount(2);
    await expect(page.locator('#sl-running')).toContainText('full set');
  });

  test('next sentence advances the walk', async ({ page }) => {
    const first = await page.locator('#sl-sentence').textContent();
    await page.locator('#sl-next').click();
    await expect(page.locator('#sl-progress')).toContainText('Sentence 2 of 338');
    expect(await page.locator('#sl-sentence').textContent()).not.toBe(first);
  });

  test('a different set restarts the walk at its own length', async ({ page }) => {
    await page.locator('#sl-walk-set').selectOption('house');
    await expect(page.locator('#sl-progress')).toContainText('Sentence 1 of 262');
  });

  test('every sentence shows a table of all three models', async ({ page }) => {
    await page.getByRole('tab', { name: 'Every sentence' }).click();
    await expect(page.locator('#sl-summary tbody tr')).toHaveCount(3);
    await expect(page.locator('#sl-head th')).toHaveCount(6);
    await expect(page.locator('#sl-rows tr')).toHaveCount(100);
    await expect(page.locator('#sl-more')).toContainText('of 926');
  });

  test('a filter changes what the summary is counted over', async ({ page }) => {
    await page.getByRole('tab', { name: 'Every sentence' }).click();
    await page.locator('#sl-filter-set').selectOption('house');
    await expect(page.locator('#sl-summary caption')).toContainText('All 262 kept sentences');
    // system.css hides the box and draws it on the label, so a visitor clicks the label.
    await page.getByText('Only skills held out of training').click();
    await expect(page.locator('#sl-summary caption')).toContainText('held-out skills');
  });

  test('showing more adds a page of rows', async ({ page }) => {
    await page.getByRole('tab', { name: 'Every sentence' }).click();
    await page.locator('#sl-more').click();
    await expect(page.locator('#sl-rows tr')).toHaveCount(200);
  });

  test('the scope line states what was ranked against what', async ({ page }) => {
    await expect(page.locator('#sl-scope')).toContainText('926 test sentences');
    await expect(page.locator('#sl-scope')).toContainText('13,891 skills');
    await expect(page.locator('#sl-scope')).toContainText('Top 10 kept');
  });
});
