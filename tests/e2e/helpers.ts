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
  opts: {
    signedIn?: { email: string; name: string } | null;
    /** The backend will not answer: skip the wait for it. */
    offline?: boolean;
  } = {},
) {
  // The editor probes /auth/me on mount (self-hosted Google session). Mock it here so
  // every test is hermetic: signed out (401) by default, or a given identity (200).
  await page.route('**/auth/me', (r) =>
    r.fulfill({
      status: opts.signedIn ? 200 : 401,
      contentType: 'application/json',
      body: JSON.stringify(
        opts.signedIn ? { authenticated: true, ...opts.signedIn } : { authenticated: false },
      ),
    }),
  );
  await page.goto(path);
  await expect(page.locator('.stage[data-hydrated]')).toBeAttached({ timeout: 15000 });

  // A signed-in test works against loaded resumes, so the handshake has to land
  // before it starts. This helper owns that wait, so how the editor reports being
  // connected stays one place, and asking for a session is all a test has to say.
  if (opts.signedIn && !opts.offline) {
    await expect(page.locator('.conn')).toContainText('connected', { timeout: 15000 });
  }
}
