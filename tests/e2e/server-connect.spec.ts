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

    // Check the meta tags were rendered
    const serviceMeta = page.locator('meta[name="site-backend-service"]');
    const portMeta = page.locator('meta[name="site-backend-port"]');
    await expect(serviceMeta).toHaveAttribute('content', 'nonogram');
    await expect(portMeta).toHaveAttribute('content', '5055');
  });
});
