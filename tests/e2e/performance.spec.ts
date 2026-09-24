import { test, expect } from '@playwright/test';

/**
 * Performance assertions — complement Lighthouse CI by catching runtime
 * regressions early. These run against the built output a shared CI runner
 * serves, so the thresholds stay generous: they catch a gross regression, and
 * Lighthouse CI owns the real budgets.
 *
 * Paint metrics belong to Lighthouse. Headless Chromium leaves the `paint`
 * entry type empty, through `getEntriesByType` and through a buffered observer
 * alike, so FCP and LCP are unmeasurable from here.
 */

interface PerfTimings {
  domContentLoaded: number;
  load: number;
}

/**
 * Long tasks never land in the performance timeline, so `getEntriesByType('longtask')`
 * answers an empty array however busy the page was. The only way to see them is an
 * observer registered before the page runs.
 */
async function collectLongTasks(
  page: import('@playwright/test').Page,
  url: string,
): Promise<number[]> {
  await page.addInitScript(() => {
    (globalThis as { __longTasks?: number[] }).__longTasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        (globalThis as { __longTasks?: number[] }).__longTasks?.push(entry.duration);
      }
    }).observe({ type: 'longtask', buffered: true });
  });
  await page.goto(url);
  await page.waitForLoadState('load');
  return page.evaluate(() => (globalThis as { __longTasks?: number[] }).__longTasks ?? []);
}

async function getTimings(page: import('@playwright/test').Page): Promise<PerfTimings> {
  await page.waitForLoadState('load');
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return {
      domContentLoaded: nav?.domContentLoadedEventEnd ?? 0,
      load: nav?.loadEventEnd ?? 0,
    };
  });
}

test.describe('Performance assertions', () => {
  test('home page DOMContentLoaded under 3 seconds', async ({ page }) => {
    await page.goto('/');
    const { domContentLoaded } = await getTimings(page);
    expect(domContentLoaded).toBeLessThan(3000);
  });

  test('classifier demo page loads without long tasks over 1 second', async ({ page }) => {
    const tasks = await collectLongTasks(page, '/projects/ai-ml/app/');
    const longest = Math.max(0, ...tasks);
    // Printed so the log carries the margin against the threshold.
    console.log(`long tasks: ${String(tasks.length)}, longest ${String(Math.round(longest))}ms`);
    expect(longest).toBeLessThan(1000);
  });

  test('nonogram demo page total load under 5 seconds', async ({ page }) => {
    await page.goto('/projects/quantum-nonogram-solver/app/');
    const { load } = await getTimings(page);
    expect(load).toBeLessThan(5000);
  });
});
