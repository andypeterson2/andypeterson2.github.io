import { test, expect } from '@playwright/test';

test.describe('Live tier + SiteContract', () => {
  // A refused pass is forgotten, so a dead Bearer stops riding on later requests.
  test('an expired pass is forgotten, not kept for a retry', async ({ page }) => {
    await page.route('**/nonogram/health', (r) => r.fulfill({ status: 401, body: '' }));
    const refused = page.waitForResponse((r) => r.url().includes('/nonogram/health'));
    await page.goto('/projects/quantum-nonogram-solver/app/?pass=expired-token');
    await refused;
    await expect.poll(() => page.evaluate(() => Object.keys(sessionStorage).length)).toBe(0);
  });

  test('nonogram app declares its backend meta (deploy-based — no port)', async ({ page }) => {
    await page.goto('/projects/quantum-nonogram-solver/app/');
    const backendMeta = page.locator('meta[name="site-backend"]');
    await expect(backendMeta).toHaveAttribute('content', 'nonogram');
    // The manual host/port connect era is over: no local port is advertised.
    await expect(backendMeta).not.toHaveAttribute('data-port', /.+/);
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
      (window as any).SiteContract.health('https://api.andypeterson.dev'),
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
      (window as any).SiteContract.request('https://api.andypeterson.dev/boom'),
    );
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('invalid_clues');
  });

  test('pollHealth emits connecting then connected against a healthy backend', async ({ page }) => {
    // The contract's own poller, exercised directly: the apps report their own state,
    // so nothing on a page drives it.
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
            'https://api.andypeterson.dev',
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

// The live tier ships only where a backend is; the pass lane everywhere.
test.describe('Pass lane and live tier', () => {
  test('pages without a backend load no live tier', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => 'SiteContract' in window)).toBe(false);
    expect(await page.evaluate(() => 'SitePass' in window)).toBe(true);
  });

  test('a demo with a backend loads it', async ({ page }) => {
    await page.goto('/projects/quantum-nonogram-solver/app/');
    await expect(page.locator('meta[name="site-backend"]')).toHaveCount(1);
    expect(await page.evaluate(() => 'SiteContract' in window)).toBe(true);
  });

  test('a #pass= link is read and scrubbed from the address bar', async ({ page }) => {
    await page.route('**/nonogram/health', (r) => r.fulfill({ status: 401, body: '' }));
    // The probe only fires once the fragment has been read, so it gates the assertion.
    const probed = page.waitForResponse((r) => r.url().includes('/nonogram/health'));
    await page.goto('/projects/quantum-nonogram-solver/app/#pass=frag-token');
    await probed;
    expect(new URL(page.url()).hash).toBe('');
  });
});
