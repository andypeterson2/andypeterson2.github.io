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

  test('auto-connects to the fixed gateway origin and turns the dot green on load (cv embed)', async ({ page }) => {
    // With one fixed front door, the app auto-fires navbar:connect on load — no modal.
    // The cv embed re-runs init() over /api/* on connect, so mock the backend broadly
    // (list endpoints → [], health → the envelope, everything else → {}).
    const healthBody = JSON.stringify({ status: 'ok', service: 'cv', version: '1.0.0', uptime_s: 4 });
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      let body = '{}';
      if (path.endsWith('/health')) body = healthBody;
      else if (path.includes('/documents/')) body = '{"sections":[]}';
      else if (/\/(sections|persons)$/.test(path) || path.includes('/coverletter/sections')) body = '[]';
      route.fulfill({ status: 200, contentType: 'application/json', body });
    });
    await page.route('**/health', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: healthBody }),
    );
    // Capture the navbar:connect the modal auto-fires (dispatched on document during init).
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__connects = [];
      document.addEventListener('navbar:connect', (e) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__connects.push((e as CustomEvent).detail),
      );
    });

    await page.goto('/projects/latex-resume-editor/app/');
    const navItem = page.locator('.server-nav-item');
    // The dot goes green WITHOUT opening the modal — auto-connect drove the whole flow.
    await expect(navItem.locator('.sn-dot')).toHaveClass(/sn-green/, { timeout: 8000 });

    // …and it fired with the fixed gateway base (…/cv), not a manually-entered host.
    const connects = await page.evaluate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (window as any).__connects as Array<{ service: string; url: string }>,
    );
    expect(connects.length).toBeGreaterThan(0);
    expect(connects[connects.length - 1].service).toBe('cv');
    expect(connects[connects.length - 1].url).toMatch(/\/cv$/);
  });
});
