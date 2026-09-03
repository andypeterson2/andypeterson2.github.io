import { test, expect } from '@playwright/test';

/**
 * The app frontends are TypeScript modules under src/apps/, bundled per page by
 * Astro (their behavior is covered by the classifier-app / nonogram / server-
 * connect e2e suites). What remains under public/ is static data + the one
 * vendored classic script — this spec asserts those are still reachable.
 */

test.describe('Owned static asset serving', () => {
  const jsonAssets = [
    // in-browser classifier model weights (drift-checked against the canonical
    // exports by the weights-sync CI job)
    '/classifiers/models/mnist.json',
    '/classifiers/models/iris.json',
    '/classifiers/models/qsvm-mnist.json',
    '/classifiers/models/qsvm-iris.json',
    // nonogram gallery of pre-computed quantum runs
    '/nonogram/gallery/index.json',
  ];

  for (const path of jsonAssets) {
    test(`serves ${path}`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()['content-type'], path).toContain('json');
    });
  }

  test('serves the vendored Socket.IO client', async ({ request }) => {
    const response = await request.get('/vendor/socket.io-4.7.5.min.js');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('javascript');
  });

  test('non-existent asset returns 404', async ({ request }) => {
    const response = await request.get('/classifiers/js/does-not-exist.js');
    expect(response.status()).toBe(404);
  });
});
