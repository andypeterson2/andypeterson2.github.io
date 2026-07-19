import { expect, type Page } from '@playwright/test';

/** The deployed path of the CV editor island. */
export const EDITOR_APP = '/projects/latex-resume-editor/app/';

/**
 * Navigate to the CV editor and wait for the Svelte island to hydrate.
 *
 * The stage element gains `data-hydrated` in the island's onMount — the point
 * at which Svelte has attached its (delegated) event handlers. Waiting for that
 * marker is a deterministic replacement for the old click-and-retry (`toPass`)
 * dance: once it's present, a single click lands on a live handler, so tests
 * can interact directly and rely on Playwright's own auto-waiting for the rest.
 *
 * Set up any `page.route(...)` mocks before calling this — the mount fires the
 * backend probe, so routes must be registered first.
 */
export async function gotoEditor(
  page: Page,
  path = EDITOR_APP,
  opts: { keepInvite?: boolean } = {},
) {
  await page.goto(path);
  await expect(page.locator('.stage[data-hydrated]')).toBeAttached({ timeout: 15000 });

  // The demo invite is a modal pop-up: its scrim blocks the editor until dismissed.
  // Most tests want to drive the editor, so dismiss it once the backend probe has
  // settled (either the invite appeared, or we connected). Pass keepInvite to the
  // few tests that exercise the invite / its guided-tour button themselves.
  if (opts.keepInvite) return;
  const invite = page.locator('.invite');
  await Promise.race([
    invite.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
    expect(page.locator('.conn'))
      .toContainText('connected', { timeout: 5000 })
      .catch(() => {}),
  ]);
  if (await invite.isVisible().catch(() => false)) {
    await invite.getByRole('button', { name: 'Dismiss' }).click();
    await expect(invite).toHaveCount(0);
  }
}
