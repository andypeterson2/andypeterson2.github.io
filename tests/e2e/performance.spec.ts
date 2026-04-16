import { test, expect } from '@playwright/test';

/**
 * Performance assertions — complement Lighthouse CI by catching
 * runtime regressions early. Thresholds are generous (dev server is
 * slower than production) and only intended to catch gross regressions.
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
  test('home page DOMContentLoaded under 3 seconds in dev', async ({ page }) => {
    await page.goto('/');
    const { domContentLoaded } = await getTimings(page);
    expect(domContentLoaded).toBeLessThan(3000);
  });

  test('home page first contentful paint under 2.5 seconds in dev', async ({ page }) => {
    await page.goto('/');
    const { firstContentfulPaint } = await getTimings(page);
    // FCP can be 0 if the browser didn't report it; skip the strict check then
    if (firstContentfulPaint > 0) {
      expect(firstContentfulPaint).toBeLessThan(2500);
    }
  });

  test('projects page loads without long tasks over 1 second', async ({ page }) => {
    await page.goto('/projects/');
    await page.waitForLoadState('load');
    const longTasks = await page.evaluate(() => {
      const tasks = performance.getEntriesByType('longtask') as PerformanceEntry[];
      return tasks.filter((t) => t.duration > 1000).length;
    });
    expect(longTasks).toBe(0);
  });

  test('about page total load under 5 seconds in dev', async ({ page }) => {
    await page.goto('/about/');
    const { load } = await getTimings(page);
    expect(load).toBeLessThan(5000);
  });
});
