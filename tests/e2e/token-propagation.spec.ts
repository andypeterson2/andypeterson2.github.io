import { test, expect } from '@playwright/test';

/**
 * Verify that design token values defined in tokens.css actually
 * propagate to rendered elements at runtime. This catches CSS var
 * scope errors that structural tests miss.
 *
 * Expected token values (from src/styles/tokens.css):
 *   --color-success: #16a34a  -> rgb(22, 163, 74)
 *   --color-warning: #d97706  -> rgb(217, 119, 6)
 *   --color-danger:  #dc2626  -> rgb(220, 38, 38)
 */

const EXPECTED = {
  success: 'rgb(22, 163, 74)',
  warning: 'rgb(217, 119, 6)',
  danger: 'rgb(220, 38, 38)',
};

async function getCssVarValue(page: import('@playwright/test').Page, varName: string) {
  return page.evaluate((name) => {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }, varName);
}

test.describe('Design token runtime propagation', () => {
  test('--color-success resolves to configured hex value', async ({ page }) => {
    await page.goto('/');
    const value = await getCssVarValue(page, '--color-success');
    expect(value).toBe('#16a34a');
  });

  test('--color-warning resolves to configured hex value', async ({ page }) => {
    await page.goto('/');
    const value = await getCssVarValue(page, '--color-warning');
    expect(value).toBe('#d97706');
  });

  test('--color-danger resolves to configured hex value', async ({ page }) => {
    await page.goto('/');
    const value = await getCssVarValue(page, '--color-danger');
    expect(value).toBe('#dc2626');
  });

  test('semantic color classes on classifier page render correct computed colors', async ({
    page,
  }) => {
    await page.route('**/api/**', (route) => route.abort());
    await page.route('**/health', (route) => route.abort());
    await page.goto('/classifiers/');

    // Inject test elements using the semantic color classes into the app.
    // This verifies the CSS selectors and tokens resolve together.
    const colors = await page.evaluate(() => {
      const container = document.getElementById('classifier-app');
      if (!container) return null;
      const el = document.createElement('div');
      el.innerHTML = `
        <span class="conf-high">high</span>
        <span class="acc-med">med</span>
        <span class="acc-low">low</span>
      `;
      container.appendChild(el);
      const result = {
        confHigh: getComputedStyle(el.querySelector('.conf-high')!).color,
        accMed: getComputedStyle(el.querySelector('.acc-med')!).color,
        accLow: getComputedStyle(el.querySelector('.acc-low')!).color,
      };
      container.removeChild(el);
      return result;
    });

    expect(colors?.confHigh).toBe(EXPECTED.success);
    expect(colors?.accMed).toBe(EXPECTED.warning);
    expect(colors?.accLow).toBe(EXPECTED.danger);
  });
});
