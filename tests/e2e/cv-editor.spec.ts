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
    // Sign-in is a button that opens the Access login popup (no hand-built URL).
    await expect(banner.getByRole('button', { name: /Sign in with Google/i })).toBeVisible();
  });

  test('loads and renders a real profile when authenticated', async ({ page }) => {
    // The reworked backend is id-addressable: GET /persons lists profiles,
    // GET /persons/:pid returns the full master. Mock both and assert the mapper
    // renders the profile's name + entries (not the demo).
    const master = {
      person: { id: 7, name: 'Ada Lovelace' },
      personal: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        position: 'Analyst',
        email: 'ada@example.com',
      },
      sections: [
        {
          id: 1,
          type: 'summary',
          title: 'Summary',
          entries: [{ id: 10, fields: { text: 'Pioneer of computing.' }, items: [], tags: [] }],
        },
        {
          id: 2,
          type: 'experience',
          title: 'Experience',
          entries: [
            {
              id: 11,
              fields: {
                position: 'Analyst',
                organization: 'Analytical Engine Co',
                location: 'London',
                date: '1843',
              },
              tags: ['math'],
              items: [{ id: 100, title: 'Notes', content: 'Wrote the first algorithm.', tags: [] }],
            },
          ],
        },
      ],
    };
    await page.route(/\/cv\/api\/persons$/, (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ persons: [{ id: 7, name: 'Ada Lovelace' }] }),
      }),
    );
    await page.route(/\/cv\/api\/persons\/7$/, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(master) }),
    );
    await page.goto('/projects/latex-resume-editor/app/');

    await expect(page.locator('.conn')).toContainText('connected');
    await expect(page.locator('.doc-head h1')).toContainText('Ada Lovelace');
    await expect(page.locator('.doc')).toContainText('Analytical Engine Co');
    await expect(page.locator('.doc')).toContainText('Wrote the first algorithm');
  });

  test('autosaves an edited field to the backend, LaTeX-escaped', async ({ page }) => {
    const master = {
      person: { id: 7, name: 'Ada Lovelace' },
      personal: { firstName: 'Ada', lastName: 'Lovelace' },
      sections: [
        {
          id: 2,
          type: 'experience',
          title: 'Experience',
          entries: [
            {
              id: 11,
              fields: { position: 'Analyst', organization: 'Acme', location: '', date: '' },
              tags: [],
              items: [],
            },
          ],
        },
      ],
    };
    await page.route(/\/cv\/api\/persons$/, (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ persons: [{ id: 7, name: 'Ada Lovelace' }] }),
      }),
    );
    await page.route(/\/cv\/api\/persons\/7$/, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(master) }),
    );
    let putBody: { fields?: Record<string, string> } | null = null;
    await page.route(/\/cv\/api\/entries\/11$/, (r) => {
      putBody = r.request().postDataJSON();
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
    });
    await page.goto('/projects/latex-resume-editor/app/');
    await expect(page.locator('.conn')).toContainText('connected');

    const inline = page.locator('.doc .edit');
    await expect(async () => {
      await page.locator('.entry').first().click();
      await expect(inline).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 8000 });

    // Edit Position with a '%' → debounced PUT /entries/11 with it escaped to '\%'.
    await inline.locator('.fld').first().locator('input').fill('Lead 50%');
    await expect(page.locator('.statusbar')).toContainText('saved', { timeout: 5000 });
    expect(putBody?.fields?.position).toBe('Lead 50\\%');
  });

  test('creates a section against the backend when connected', async ({ page }) => {
    const master = {
      person: { id: 7, name: 'Ada Lovelace' },
      personal: { firstName: 'Ada', lastName: 'Lovelace' },
      sections: [
        {
          id: 2,
          type: 'experience',
          title: 'Experience',
          entries: [{ id: 11, fields: { position: 'x' }, tags: [], items: [] }],
        },
      ],
    };
    await page.route(/\/cv\/api\/persons$/, (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ persons: [{ id: 7, name: 'Ada Lovelace' }] }),
      }),
    );
    await page.route(/\/cv\/api\/persons\/7$/, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(master) }),
    );
    let postBody: { slug?: string; type?: string; title?: string } | null = null;
    await page.route(/\/cv\/api\/persons\/7\/sections$/, (r) => {
      postBody = r.request().postDataJSON();
      return r.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 99 }),
      });
    });
    await page.goto('/projects/latex-resume-editor/app/');
    await expect(page.locator('.conn')).toContainText('connected');

    await page.locator('.add-section').click();
    await page.locator('.picker .pick').filter({ hasText: 'Skills' }).first().click();

    await expect.poll(() => postBody?.type).toBe('skills');
    expect(postBody?.slug).toBe('skills');
    await expect(page.locator('.sec-head h2').filter({ hasText: 'Skills' })).toBeVisible();
  });

  test('deletes a section via the backend (confirmed)', async ({ page }) => {
    const master = {
      person: { id: 7, name: 'Ada Lovelace' },
      personal: { firstName: 'Ada', lastName: 'Lovelace' },
      sections: [
        { id: 2, type: 'experience', title: 'Experience', entries: [] },
        { id: 3, type: 'skills', title: 'Skills', entries: [] },
      ],
    };
    await page.route(/\/cv\/api\/persons$/, (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ persons: [{ id: 7, name: 'Ada Lovelace' }] }),
      }),
    );
    await page.route(/\/cv\/api\/persons\/7$/, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(master) }),
    );
    let deletedPath: string | null = null;
    await page.route(/\/cv\/api\/sections\/\d+$/, (r) => {
      deletedPath = new URL(r.request().url()).pathname;
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
    });
    page.on('dialog', (d) => void d.accept());
    await page.goto('/projects/latex-resume-editor/app/');
    await expect(page.locator('.conn')).toContainText('connected');

    const exp = page.locator('.sec').filter({ hasText: 'Experience' }).first();
    await exp.locator('.tool.danger').click();

    await expect.poll(() => deletedPath).toContain('/sections/2');
    await expect(page.locator('.sec-head h2').filter({ hasText: 'Experience' })).toHaveCount(0);
  });

  test('drag-reorders entries and persists the new id order', async ({ page }) => {
    const master = {
      person: { id: 7, name: 'Ada Lovelace' },
      personal: { firstName: 'Ada', lastName: 'Lovelace' },
      sections: [
        {
          id: 2,
          type: 'experience',
          title: 'Experience',
          entries: [
            { id: 11, fields: { position: 'First', organization: 'Alpha' }, tags: [], items: [] },
            { id: 12, fields: { position: 'Second', organization: 'Beta' }, tags: [], items: [] },
          ],
        },
      ],
    };
    await page.route(/\/cv\/api\/persons$/, (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ persons: [{ id: 7, name: 'Ada Lovelace' }] }),
      }),
    );
    await page.route(/\/cv\/api\/persons\/7$/, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(master) }),
    );
    let orderBody: { ids?: number[] } | null = null;
    await page.route(/\/cv\/api\/sections\/2\/entries\/order$/, (r) => {
      orderBody = r.request().postDataJSON();
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
    });
    await page.goto('/projects/latex-resume-editor/app/');
    await expect(page.locator('.conn')).toContainText('connected');

    const entries = page.locator('.sec .entry');
    await expect(entries).toHaveCount(2);
    // Drag the 2nd entry (Beta / id 12) onto the 1st (Alpha / id 11) → [12, 11].
    await entries.nth(1).dragTo(entries.nth(0));
    await expect.poll(() => orderBody?.ids).toEqual([12, 11]);
  });
});
