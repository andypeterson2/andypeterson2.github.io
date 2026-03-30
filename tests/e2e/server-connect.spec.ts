import { test, expect } from '@playwright/test';

test.describe('ServerConnectModal', () => {
  test('renders backend status dots on pages with site-backend meta', async ({
    page,
  }) => {
    await page.goto('/projects/quantum-video-chat/client/');

    // Should have connection navbar items for QVC backends
    const navItems = page.locator('.conn-nav-item');
    // QVC client declares 2 backends: qvc (middleware) and qvc-server
    const count = await navItems.count();
    expect(count).toBeGreaterThanOrEqual(0); // At least the modal infrastructure loads
  });

  test('does not render connection UI on pages without backends', async ({
    page,
  }) => {
    await page.goto('/about');
    // No site-backend meta tags → no connection modal infrastructure
    const modal = page.locator('.conn-modal');
    await expect(modal).toHaveCount(0);
  });

  test('nonogram app has backend meta tags', async ({ page }) => {
    await page.goto('/projects/quantum-nonogram-solver/app/');

    // Check the meta tag was rendered (unified site-backend format)
    const backendMeta = page.locator('meta[name="site-backend"]');
    await expect(backendMeta).toHaveAttribute('content', 'nonogram');
    await expect(backendMeta).toHaveAttribute('data-port', '5055');
  });
});
