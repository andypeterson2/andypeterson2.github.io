import { test, expect } from '@playwright/test';

/**
 * Each sub-app's frontend is vendored under public/<app>/ and served at the site root
 * by Astro. (The former serve-subprojects Vite middleware that rewrote /nonogram/,
 * /qvc/, etc. to submodule directories was removed in Phase E — assets now live in
 * public/ and are served directly, so there is no directory-index rewriting.)
 */

test.describe('Vendored sub-app asset serving', () => {
  const assets = [
    // classifiers (quantum-protein-kernel) embed
    '/classifiers/js/app.js',
    '/classifiers/js/connection.js',
    '/classifiers/js/sse.js',
    '/classifiers/js/chart.js',
    // nonogram embed
    '/nonogram/js/app.js',
    // qvc embed (vendored under /video-chat/)
    '/video-chat/js/app.js',
    '/video-chat/js/dashboard.js',
    // cv editor embed
    '/cv/api.js',
    // shared, same-origin portal scripts
    '/js/contract-client.js',
    '/js/server-connect-modal.js',
  ];

  for (const path of assets) {
    test(`serves ${path}`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()['content-type'], path).toContain('javascript');
    });
  }

  test('non-existent asset returns 404', async ({ request }) => {
    const response = await request.get('/classifiers/js/does-not-exist.js');
    expect(response.status()).toBe(404);
  });
});
