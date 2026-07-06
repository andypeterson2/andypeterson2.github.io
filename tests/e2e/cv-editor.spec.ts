import { test, expect } from '@playwright/test';

/**
 * Smoke tests for the rewritten document-first CV editor (Svelte island).
 * The editor auto-connects to the live backend on mount, so each test controls
 * that fetch (abort / 403) to stay deterministic and never touch the real gateway.
 */
test.describe('CV editor (document-first rewrite)', () => {
  test('renders the full-bleed shell and the demo profile', async ({ page }) => {
    // Backend unreachable → editor stays on the local demo.
    await page.route('**/api/**', (route) => route.abort());
    await page.goto('/projects/latex-resume-editor/app/');

    // Island hydrated: the System-6 menubar is present.
    await expect(page.locator('.menubar')).toContainText('Editor');
    // The demo persona renders (fictional — safe in a public repo).
    await expect(page.locator('.doc-head h1')).toContainText('Jordan Rivera');
    // Portal chrome is stripped in bare mode.
    await expect(page.locator('.site-menubar')).toBeHidden();
    // Connection resolves to demo, not connected.
    await expect(page.locator('.conn')).toContainText('demo');
  });

  test('clicking an entry opens the type-aware inline editor', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await page.goto('/projects/latex-resume-editor/app/');

    // Retry the click until the island has hydrated and the handler is live
    // (the demo document is server-rendered, so the entry exists before hydration).
    const inline = page.locator('.doc .edit');
    await expect(async () => {
      await page.locator('.entry').first().click();
      await expect(inline).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 8000 });

    // Role fields + the collapse control for an experience entry.
    await expect(inline.locator('.lbl', { hasText: 'Position' })).toBeVisible();
    await expect(inline.locator('button', { hasText: 'Done' })).toBeVisible();
  });

  test('offers Access sign-in when the backend requires auth', async ({ page }) => {
    // Simulate Cloudflare Access blocking the unauthenticated data probe.
    await page.route('**/api/persons', (route) => route.fulfill({ status: 403 }));
    await page.goto('/projects/latex-resume-editor/app/');

    const banner = page.locator('.signin');
    await expect(banner).toBeVisible();
    await expect(banner.locator('a', { hasText: 'Sign in with Google' })).toHaveAttribute(
      'href',
      /cdn-cgi\/access\/login\/api\.andypeterson\.dev\?redirect_url=/,
    );
  });
});
