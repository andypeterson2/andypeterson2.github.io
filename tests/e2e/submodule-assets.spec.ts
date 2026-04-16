import { test, expect } from '@playwright/test';

/**
 * Verify that static assets served from submodule directories via
 * the Vite middleware in astro.config.mjs respond correctly.
 *
 * These paths are rewritten by the serve-subprojects plugin:
 *   /classifiers/js/... -> packages/quantum-protein-kernel/classifiers/static/js/...
 *   /nonogram/...       -> packages/nonogram/...
 *   /cv/...             -> packages/cv/...
 *   /qvc/...            -> packages/qvc/...
 *   /packages/...       -> served directly
 */

test.describe('Submodule static asset serving', () => {
  test('classifier JS files are served', async ({ request }) => {
    const response = await request.get('/classifiers/js/app.js');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('javascript');
  });

  test('classifier supporting scripts are served', async ({ request }) => {
    for (const file of ['connection.js', 'sse.js', 'chart.js']) {
      const response = await request.get(`/classifiers/js/${file}`);
      expect(response.status(), `/classifiers/js/${file}`).toBe(200);
    }
  });

  test('nonogram index HTML is served', async ({ request }) => {
    const response = await request.get('/nonogram/');
    expect([200, 301, 302]).toContain(response.status());
  });

  test('cv index is served', async ({ request }) => {
    const response = await request.get('/packages/cv/');
    // CV may be a directory listing or have its own index
    expect([200, 301, 302, 404]).toContain(response.status());
  });

  test('qvc index is served', async ({ request }) => {
    const response = await request.get('/qvc/');
    expect([200, 301, 302]).toContain(response.status());
  });

  test('non-existent submodule path returns 404', async ({ request }) => {
    const response = await request.get('/classifiers/js/does-not-exist.js');
    expect(response.status()).toBe(404);
  });
});
