import { expect, type Locator, type Page } from '@playwright/test';

// A real, minimal 2-page US-Letter PDF with a valid xref, so the preview renders it.
// Each page paints a filled rectangle as well as text, which is what lets a test
// assert the canvas has ink: standard-14 text needs font data the viewer is not given.
export const MINIMAL_PDF =
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 7 0 R >> >> >>\nendobj\n4 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >>\nendobj\n5 0 obj\n<< /Length 69 >>\nstream\n0 0 0 rg 72 560 240 120 re f\nBT /F1 24 Tf 72 700 Td (Page One) Tj ET\nendstream\nendobj\n6 0 obj\n<< /Length 69 >>\nstream\n0 0 0 rg 72 560 240 120 re f\nBT /F1 24 Tf 72 700 Td (Page Two) Tj ET\nendstream\nendobj\n7 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 8\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000121 00000 n \n0000000247 00000 n \n0000000373 00000 n \n0000000491 00000 n \n0000000609 00000 n \ntrailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n679\n%%EOF\n';

/**
 * Assert a rendered PDF page has ink on it. Counting canvases passes on an empty
 * pane, and a page that drew nothing is reported the same way a good one is.
 */
export async function expectInk(canvas: Locator) {
  await expect
    .poll(() =>
      canvas.evaluate((c: HTMLCanvasElement) => {
        const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        let dark = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] < 200 && d[i + 3] > 0) dark += 1;
        return dark;
      }),
    )
    .toBeGreaterThan(100);
}

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
    /** Let the published resume fail to load, as it does with no network. */
    publishedPdf?: boolean;
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
  // Signed out, the preview shows the resume the site publishes. It is a real
  // request to the gateway's root, so every test answers it rather than reaching
  // the network: a small valid PDF by default, a failure when a test asks for one.
  await page.route('**/resume.pdf', (r) =>
    opts.publishedPdf === false
      ? r.abort()
      : r.fulfill({ status: 200, contentType: 'application/pdf', body: MINIMAL_PDF }),
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
