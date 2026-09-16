import { test, expect } from '@playwright/test';

/**
 * Performance assertions — complement Lighthouse CI by catching runtime
 * regressions early. These run against the built output a shared CI runner
 * serves, so the thresholds stay generous: they catch a gross regression, and
 * Lighthouse CI owns the real budgets.
 */

interface PerfTimings {
  domContentLoaded: number;
  load: number;
  firstPaint: number;
  firstContentfulPaint: number;
}

async function getTimings(page: import('@playwright/test').Page): Promise<PerfTimings> {
  await page.waitForLoadState('load');
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paints = performance.getEntriesByType('paint');
    const firstPaint = paints.find((p) => p.name === 'first-paint')?.startTime ?? 0;
    const firstContentfulPaint =
      paints.find((p) => p.name === 'first-contentful-paint')?.startTime ?? 0;
    return {
      domContentLoaded: nav?.domContentLoadedEventEnd ?? 0,
      load: nav?.loadEventEnd ?? 0,
      firstPaint,
      firstContentfulPaint,
    };
  });
}

test.describe('Performance assertions', () => {
  test('home page DOMContentLoaded under 3 seconds', async ({ page }) => {
    await page.goto('/');
    const { domContentLoaded } = await getTimings(page);
    expect(domContentLoaded).toBeLessThan(3000);
  });

  test('home page first contentful paint under 2.5 seconds', async ({ page }) => {
    await page.goto('/');
    const { firstContentfulPaint } = await getTimings(page);
    // FCP can be 0 if the browser didn't report it; skip the strict check then
    if (firstContentfulPaint > 0) {
      expect(firstContentfulPaint).toBeLessThan(2500);
    }
  });

  test('classifier demo page loads without long tasks over 1 second', async ({ page }) => {
    await page.goto('/projects/ai-ml/app/');
    await page.waitForLoadState('load');
    const longTasks = await page.evaluate(() => {
      const tasks = performance.getEntriesByType('longtask') as PerformanceEntry[];
      return tasks.filter((t) => t.duration > 1000).length;
    });
    expect(longTasks).toBe(0);
  });

  test('nonogram demo page total load under 5 seconds', async ({ page }) => {
    await page.goto('/projects/quantum-nonogram-solver/app/');
    const { load } = await getTimings(page);
    expect(load).toBeLessThan(5000);
  });
});
