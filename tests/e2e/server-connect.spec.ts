import { test, expect } from '@playwright/test';

test.describe('ServerConnectModal + SiteContract', () => {
  test('renders a backend status dot on a page with a site-backend meta', async ({ page }) => {
    await page.goto('/projects/quantum-nonogram-solver/app/');
    const navItem = page.locator('.server-nav-item');
    await expect(navItem).toHaveCount(1);
    await expect(navItem.locator('.sn-dot')).toBeVisible();
  });

  test('does not render connection UI on pages without backends', async ({ page }) => {
    await page.goto('/about');
    // No site-backend meta tags → no connect nav item and no modal.
    await expect(page.locator('.server-nav-item')).toHaveCount(0);
    await expect(page.locator('.sn-modal')).toHaveCount(0);
  });

  test('nonogram app declares its backend meta', async ({ page }) => {
    await page.goto('/projects/quantum-nonogram-solver/app/');
    const backendMeta = page.locator('meta[name="site-backend"]');
    await expect(backendMeta).toHaveAttribute('content', 'nonogram');
    await expect(backendMeta).toHaveAttribute('data-port', '5055');
  });

  test('SiteContract is loaded and parses /health in the browser', async ({ page }) => {
    // Intercept the cross-origin health probe with a healthy contract response.
    await page.route('**/health', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', service: 'nonogram', version: '1.0.0', uptime_s: 3 }),
      }),
    );
    await page.goto('/projects/quantum-nonogram-solver/app/');
    const health = await page.evaluate(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SiteContract.health('http://localhost:5055'),
    );
    expect(health.reachable).toBe(true);
    expect(health.service).toBe('nonogram');
    expect(health.status).toBe('ok');
  });

  test('SiteContract.request surfaces the error envelope in the browser', async ({ page }) => {
    await page.route('**/boom', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'invalid_clues', message: 'bad clues' } }),
      }),
    );
    await page.goto('/projects/quantum-nonogram-solver/app/');
    const res = await page.evaluate(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SiteContract.request('http://localhost:5055/boom'),
    );
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('invalid_clues');
  });

  test('pollHealth emits connecting then connected against a healthy backend', async ({ page }) => {
    // Proves the modal's fallback poller mechanism: it drives the dot from /health for
    // any backend whose embed does not manage its own status (current pages all self-report,
    // so exercise the poller directly).
    await page.route('**/health', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', service: 'nonogram', version: '1.0.0', uptime_s: 2 }),
      }),
    );
    await page.goto('/projects/quantum-nonogram-solver/app/');
    const seen = await page.evaluate(
      () =>
        new Promise<string[]>((resolve) => {
          const states: string[] = [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const stop = (window as any).SiteContract.pollHealth(
            'http://localhost:5055',
            (s: string) => {
              states.push(s);
              if (s === 'connected') {
                stop();
                resolve(states);
              }
            },
            { intervalMs: 1000 },
          );
          setTimeout(() => resolve(states), 6000); // safety net
        }),
    );
    expect(seen[0]).toBe('connecting');
    expect(seen).toContain('connected');
  });
});
