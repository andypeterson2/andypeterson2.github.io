import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { gotoEditor } from './helpers';

/**
 * Smoke tests for the rewritten document-first CV editor (Svelte island).
 * The editor auto-connects to the live backend on mount, so each test controls
 * that fetch (abort / 403) to stay deterministic and never touch the real gateway.
 */

/** Mock a signed-in profile that owns one no-rules variant ("Full CV", id 50). */
async function mockAdaWithVariant(page: Page) {
  const main = {
    person: { id: 7, name: 'Ada Lovelace' },
    personal: { firstName: 'Ada', lastName: 'Lovelace' },
    sections: [
      {
        id: 2,
        type: 'experience',
        title: 'Experience',
        entries: [{ id: 11, fields: { position: 'Analyst' }, tags: [], items: [] }],
      },
    ],
    variants: [
      { id: 50, name: 'Full CV', kind: 'cv', rules: { include: [], exclude: [] }, sections: [] },
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
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(main) }),
  );
}

/** Open the variant drawer and pick a variant by name. */
async function selectVariant(page: Page, name: string | RegExp) {
  await page.locator('.toolbar .variant-btn').click();
  await expect(page.locator('.drawer')).toBeVisible();
  await page.locator('.drawer .opt').filter({ hasText: name }).click();
  await page.keyboard.press('Escape');
}
/** Select the "Full CV" variant (drives the lens + preview target). */
async function selectFullCV(page: Page) {
  await selectVariant(page, 'Full CV');
}

test.describe('CV editor (document-first rewrite)', () => {
  test('renders the full-bleed shell and the demo profile', async ({ page }) => {
    // Backend unreachable → editor stays on the local demo.
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);

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
    await gotoEditor(page);

    // gotoEditor waited for hydration, so the entry's click handler is live.
    const inline = page.locator('.doc .edit');
    await page.locator('.entry').first().click();
    await expect(inline).toBeVisible();

    // Role fields + the collapse control for an experience entry.
    await expect(inline.locator('.lbl', { hasText: 'Position' })).toBeVisible();
    await expect(inline.locator('button', { hasText: 'Done' })).toBeVisible();
  });

  test('offers Access sign-in when the backend requires auth', async ({ page }) => {
    // Simulate Cloudflare Access blocking the unauthenticated data probe.
    await page.route('**/api/persons', (route) => route.fulfill({ status: 403 }));
    await gotoEditor(page);

    const banner = page.locator('.signin');
    await expect(banner).toBeVisible();
    // Sign-in is a button that opens the Access login popup (no hand-built URL).
    await expect(banner.getByRole('button', { name: /Sign in with Google/i })).toBeVisible();
  });

  test('loads and renders a real profile when authenticated', async ({ page }) => {
    // The reworked backend is id-addressable: GET /persons lists profiles,
    // GET /persons/:pid returns the full main. Mock both and assert the mapper
    // renders the profile's name + entries (not the demo).
    const main = {
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
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(main) }),
    );
    await gotoEditor(page);

    await expect(page.locator('.conn')).toContainText('connected');
    await expect(page.locator('.doc-head h1')).toContainText('Ada Lovelace');
    await expect(page.locator('.doc')).toContainText('Analytical Engine Co');
    await expect(page.locator('.doc')).toContainText('Wrote the first algorithm');
  });

  test('autosaves an edited field to the backend, LaTeX-escaped', async ({ page }) => {
    const main = {
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
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(main) }),
    );
    let putBody: { fields?: Record<string, string> } | null = null;
    await page.route(/\/cv\/api\/entries\/11$/, (r) => {
      putBody = r.request().postDataJSON();
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
    });
    await gotoEditor(page);
    await expect(page.locator('.conn')).toContainText('connected');

    const inline = page.locator('.doc .edit');
    await page.locator('.entry').first().click();
    await expect(inline).toBeVisible();

    // Edit Position with a '%' → debounced PUT /entries/11 with it escaped to '\%'.
    await inline.locator('.fld').first().locator('input').fill('Lead 50%');
    await expect(page.locator('.statusbar')).toContainText('saved', { timeout: 5000 });
    expect(putBody?.fields?.position).toBe('Lead 50\\%');
  });

  test('creates a section against the backend when connected', async ({ page }) => {
    const main = {
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
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(main) }),
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
    await gotoEditor(page);
    await expect(page.locator('.conn')).toContainText('connected');

    await page.locator('.add-section').click();
    await page.locator('.picker .pick').filter({ hasText: 'Skills' }).first().click();

    await expect.poll(() => postBody?.type).toBe('skills');
    expect(postBody?.slug).toBe('skills');
    await expect(page.locator('.sec-head h2').filter({ hasText: 'Skills' })).toBeVisible();
  });

  test('deletes a section via the backend (confirmed)', async ({ page }) => {
    const main = {
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
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(main) }),
    );
    let deletedPath: string | null = null;
    await page.route(/\/cv\/api\/sections\/\d+$/, (r) => {
      deletedPath = new URL(r.request().url()).pathname;
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
    });
    page.on('dialog', (d) => void d.accept());
    await gotoEditor(page);
    await expect(page.locator('.conn')).toContainText('connected');

    const exp = page.locator('.sec').filter({ hasText: 'Experience' }).first();
    await exp.locator('.tool.danger').click();

    await expect.poll(() => deletedPath).toContain('/sections/2');
    await expect(page.locator('.sec-head h2').filter({ hasText: 'Experience' })).toHaveCount(0);
  });

  test('drag-reorders entries and persists the new id order', async ({ page }) => {
    const main = {
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
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(main) }),
    );
    let orderBody: { ids?: number[] } | null = null;
    await page.route(/\/cv\/api\/sections\/2\/entries\/order$/, (r) => {
      orderBody = r.request().postDataJSON();
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
    });
    await gotoEditor(page);
    await expect(page.locator('.conn')).toContainText('connected');

    const entries = page.locator('.sec .entry');
    await expect(entries).toHaveCount(2);
    // Drag the 2nd entry (Beta / id 12) onto the 1st (Alpha / id 11) → [12, 11].
    await entries.nth(1).dragTo(entries.nth(0));
    await expect.poll(() => orderBody?.ids).toEqual([12, 11]);
  });

  test('toolbar opens and closes the drawers', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);
    await expect(page.locator('.menubar')).toContainText('Editor');

    // Style drawer — accent swatches; close box dismisses.
    await page.getByRole('button', { name: 'Style', exact: true }).click();
    await expect(page.locator('.drawer')).toBeVisible();
    await expect(page.locator('.drawer')).toContainText('Accent color');
    await expect(page.locator('.drawer .swatch')).toHaveCount(9);
    await page.locator('.drawer .close').click();
    await expect(page.locator('.drawer')).toHaveCount(0);

    // Layouts drawer — Escape dismisses.
    await page.getByRole('button', { name: 'Layout', exact: true }).click();
    await expect(page.locator('.drawer')).toContainText('LaTeX template');
    await page.keyboard.press('Escape');
    await expect(page.locator('.drawer')).toHaveCount(0);

    // Tags drawer — the spotlight note; close box dismisses.
    await page.getByRole('button', { name: 'Tags', exact: true }).click();
    await expect(page.locator('.drawer')).toContainText('spotlight where it');
    await page.locator('.drawer .close').click();
    await expect(page.locator('.drawer')).toHaveCount(0);
  });

  test('tags drawer spotlights matching entries; chips edit tags inline', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);
    await expect(page.locator('.menubar')).toContainText('Editor');

    // The demo profile's baked-in vocabulary surfaces with usage counts
    // (#backend sits on 2 entries + 2 bullets → 4).
    const drawer = page.locator('.drawer');
    await page.getByRole('button', { name: 'Tags', exact: true }).click();
    await expect(drawer).toBeVisible();
    const backendRow = drawer.locator('.row', { hasText: 'backend' });
    await expect(backendRow).toContainText('4');

    // Spotlight #backend: entries carrying it stay lit, the untagged summary dims.
    await backendRow.click();
    await expect(page.locator('.doc .para')).toHaveClass(/dim/);
    await expect(
      page.locator('.doc .entry').filter({ hasText: 'Acme Technologies' }),
    ).not.toHaveClass(/dim/);

    // Clearing the spotlight restores everything.
    await drawer.locator('.clear').click();
    await expect(page.locator('.doc .para')).not.toHaveClass(/dim/);
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);

    // Inline chips: open an untagged entry and add + remove a tag.
    const inline = page.locator('.doc .edit');
    await page.locator('.entry').filter({ hasText: 'State University' }).click();
    await expect(inline).toBeVisible();

    const tagIn = inline.locator('.tags-row .tag-in');
    await tagIn.fill('honors');
    await tagIn.press('Enter');
    await expect(inline.locator('.tags-row .chip')).toContainText('#honors');

    await inline.locator('.tags-row .chip .cx').click();
    await expect(inline.locator('.tags-row .chip')).toHaveCount(0);
  });

  test('the variant drawer applies a lens that dims excluded content', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);
    await expect(page.locator('.menubar')).toContainText('Editor');

    // Open the Variants drawer from the toolbar popup.
    const drawer = page.locator('.drawer');
    await page.locator('.toolbar .variant-btn').click();
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('lens on your main');
    // The demo ships two variants with live "shows X of Y" counts.
    await expect(drawer.locator('.opt').filter({ hasText: 'Backend Engineer' })).toContainText(
      '2/7',
    );

    // Applying it dims the untagged summary while the #backend entry stays lit.
    await drawer.locator('.opt').filter({ hasText: 'Backend Engineer' }).click();
    await expect(page.locator('.doc .para')).toHaveClass(/dim/);
    await expect(
      page.locator('.doc .entry').filter({ hasText: 'Acme Technologies' }),
    ).not.toHaveClass(/dim/);
    // The lens reaches into bullets: a #management bullet drops inside a lit entry.
    await expect(
      page.locator('.doc li').filter({ hasText: 'Mentored four engineers' }),
    ).toHaveClass(/dim/);

    // Editing a rule updates the lens live: excluding #infra vetoes that bullet.
    const excludeIn = drawer.locator('.rule').filter({ hasText: 'Exclude' }).locator('.tag-in');
    await excludeIn.fill('infra');
    await excludeIn.press('Enter');
    await expect(
      page.locator('.doc li').filter({ hasText: 'Microservices migration' }),
    ).toHaveClass(/dim/);

    // Back to Main clears the lens entirely.
    await drawer.locator('.opt').filter({ hasText: 'Main' }).click();
    await expect(page.locator('.doc .dim')).toHaveCount(0);
  });

  test('the preview pane prompts to connect in demo mode', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);
    await expect(page.locator('.menubar')).toContainText('Editor');

    await page.getByRole('button', { name: /Preview/ }).click();
    await expect(page.locator('.preview')).toBeVisible();
    await expect(page.locator('.preview')).toContainText('connect to compile');
    await expect(page.locator('.preview .pv-btn')).toBeDisabled();
  });

  test('compiles the active variant to a PDF blob in the preview', async ({ page }) => {
    await mockAdaWithVariant(page);
    let pdfHits = 0;
    await page.route(/\/cv\/api\/variants\/50\/pdf$/, (r) => {
      pdfHits += 1;
      return r.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4\n%%EOF\n' });
    });
    await gotoEditor(page);
    await expect(page.locator('.conn')).toContainText('connected');
    await selectFullCV(page);

    await page.getByRole('button', { name: /Preview/ }).click();
    const preview = page.locator('.preview');
    await preview.getByRole('button', { name: /Compile/ }).click();

    const frame = preview.locator('iframe.pv-frame');
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute('src', /^blob:/);
    await expect.poll(() => pdfHits).toBe(1);
    // The download link carries the variant filename.
    await expect(preview.getByRole('link', { name: /PDF/ })).toHaveAttribute(
      'download',
      'Full CV.pdf',
    );
  });

  test('surfaces the LaTeX log when a compile fails', async ({ page }) => {
    await mockAdaWithVariant(page);
    await page.route(/\/cv\/api\/variants\/50\/pdf$/, (r) =>
      r.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          log: '! Undefined control sequence \\qiQubitCount',
        }),
      }),
    );
    await gotoEditor(page);
    await expect(page.locator('.conn')).toContainText('connected');
    await selectFullCV(page);

    await page.getByRole('button', { name: /Preview/ }).click();
    const preview = page.locator('.preview');
    await preview.getByRole('button', { name: /Compile/ }).click();

    await expect(preview.locator('.pv-log')).toContainText('Undefined control sequence');
    await expect(preview.locator('iframe.pv-frame')).toHaveCount(0);
  });

  test('the profiles drawer prompts to sign in when in demo mode', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);
    await expect(page.locator('.menubar')).toContainText('Editor');

    const drawer = page.locator('.drawer');
    await page.locator('.toolbar .profile-btn').click();
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('Profiles live on the server');
    await expect(drawer.getByRole('button', { name: /Sign in/ })).toBeVisible();
  });

  test('creates, renames, and deletes a profile when connected', async ({ page }) => {
    const adaMain = {
      person: { id: 7, name: 'Ada Lovelace' },
      personal: { firstName: 'Ada', lastName: 'Lovelace' },
      sections: [
        {
          id: 2,
          type: 'experience',
          title: 'Experience',
          entries: [{ id: 11, fields: { position: 'Analyst' }, tags: [], items: [] }],
        },
      ],
      variants: [],
    };
    const emptyMain = {
      person: { id: 8, name: 'New profile' },
      personal: {},
      sections: [],
      variants: [],
    };

    // GET /persons lists; POST /persons creates id 8.
    await page.route(/\/cv\/api\/persons$/, (r) =>
      r.request().method() === 'POST'
        ? r.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ id: 8 }),
          })
        : r.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ persons: [{ id: 7, name: 'Ada Lovelace' }] }),
          }),
    );
    await page.route(/\/cv\/api\/persons\/7$/, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(adaMain) }),
    );
    // /persons/8 serves the main (GET), the rename (PUT), and the delete (DELETE).
    let renamedTo: string | null = null;
    let deleted = false;
    await page.route(/\/cv\/api\/persons\/8$/, (r) => {
      const m = r.request().method();
      if (m === 'PUT') {
        renamedTo = (r.request().postDataJSON() as { name: string }).name;
        return r.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '{"success":true}',
        });
      }
      if (m === 'DELETE') {
        deleted = true;
        return r.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '{"success":true}',
        });
      }
      return r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(emptyMain),
      });
    });
    page.on('dialog', (d) => void d.accept());

    await gotoEditor(page);
    await expect(page.locator('.conn')).toContainText('connected');

    const drawer = page.locator('.drawer');
    await page.locator('.toolbar .profile-btn').click();
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('.opt')).toHaveCount(1);

    // Create → a new empty profile appears, is selected, and loads (blank doc-head).
    await drawer.getByRole('button', { name: /New profile/ }).click();
    await expect(drawer.locator('.opt')).toHaveCount(2);
    await expect(page.locator('.doc-head h1.untitled')).toHaveText('Your name');

    // Rename the new profile's label via the drawer.
    const nameInput = drawer.locator('.rename .in');
    await nameInput.fill('Backend Resume');
    await nameInput.blur();
    await expect.poll(() => renamedTo).toBe('Backend Resume');
    await expect(drawer.locator('.opt').filter({ hasText: 'Backend Resume' })).toBeVisible();

    // Delete it (confirmed) → back to Ada.
    await drawer.getByRole('button', { name: /Delete profile/ }).click();
    await expect.poll(() => deleted).toBe(true);
    await expect(drawer.locator('.opt')).toHaveCount(1);
    await expect(page.locator('.doc-head h1')).toContainText('Ada Lovelace');
  });

  test('deleting the last profile shows an empty state and lets you start over', async ({
    page,
  }) => {
    const adaMain = {
      person: { id: 7, name: 'Ada Lovelace' },
      personal: { firstName: 'Ada', lastName: 'Lovelace' },
      sections: [
        {
          id: 2,
          type: 'experience',
          title: 'Experience',
          entries: [{ id: 11, fields: { position: 'Analyst' }, tags: [], items: [] }],
        },
      ],
      variants: [],
    };
    const emptyMain9 = {
      person: { id: 9, name: 'New profile' },
      personal: {},
      sections: [],
      variants: [],
    };

    await page.route(/\/cv\/api\/persons$/, (r) =>
      r.request().method() === 'POST'
        ? r.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ id: 9 }),
          })
        : r.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ persons: [{ id: 7, name: 'Ada Lovelace' }] }),
          }),
    );
    await page.route(/\/cv\/api\/persons\/7$/, (r) =>
      r.request().method() === 'DELETE'
        ? r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' })
        : r.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(adaMain),
          }),
    );
    await page.route(/\/cv\/api\/persons\/9$/, (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(emptyMain9),
      }),
    );
    page.on('dialog', (d) => void d.accept());

    await gotoEditor(page);
    await expect(page.locator('.conn')).toContainText('connected');

    const drawer = page.locator('.drawer');
    await page.locator('.toolbar .profile-btn').click();
    await expect(drawer).toBeVisible();

    // Delete the only profile → the connected empty state (NOT a sign-in prompt).
    await drawer.getByRole('button', { name: /Delete profile/ }).click();
    await expect(page.locator('.no-profiles')).toContainText('No profiles yet');
    await expect(page.locator('.doc-head')).toHaveCount(0);
    await expect(page.locator('.conn')).toContainText('connected');
    await expect(page.locator('.signin')).toHaveCount(0);

    // Close the drawer, then create from the empty state → editing resumes.
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await page.locator('.no-profiles .np-btn').click();
    await expect(page.locator('.no-profiles')).toHaveCount(0);
    await expect(page.locator('.doc-head h1.untitled')).toHaveText('Your name');
  });

  test('reorders with the keyboard (Alt+Arrow), keeps focus, and announces', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);
    await expect(page.locator('.menubar')).toContainText('Editor');

    const sectionTitles = page.locator('.doc .sec h2');
    await expect(sectionTitles.first()).toHaveText('Summary');

    // Move the first section (Summary) down.
    await page.locator('.doc .sec-head .grip').first().focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect(sectionTitles.first()).toHaveText('Experience');
    // Announced to screen readers, and focus follows the moved section's grip
    // (so repeated presses keep moving it).
    await expect(page.locator('.sr-only[aria-live]')).toContainText('Section moved to position 2');
    await expect(page.locator('.doc .sec').nth(1).locator('.sec-head .grip')).toBeFocused();

    // Entries reorder from the focused row itself (no separate grip).
    const firstEntry = page.locator('.doc .sec').first().locator('.entry').first();
    const firstEntryText = ((await firstEntry.locator('.entry-title').textContent()) ?? '').trim();
    await firstEntry.focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect(page.locator('.doc .sec').first().locator('.entry-title').nth(1)).toHaveText(
      firstEntryText,
    );
  });

  test('a cover-letter variant switches the editor to letter mode', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);
    await expect(page.locator('.menubar')).toContainText('Editor');

    // The demo ships a cover-letter variant, labelled as such in the drawer.
    await selectVariant(page, 'Cover Letter');

    // The CV document is replaced by the letter editor (header + paragraphs).
    const letter = page.locator('.letter');
    await expect(letter).toBeVisible();
    await expect(page.locator('.doc .sec')).toHaveCount(0);
    await expect(letter.locator('.para')).toHaveCount(3);

    // Add then delete a paragraph.
    await letter.getByRole('button', { name: /Add paragraph/ }).click();
    await expect(letter.locator('.para')).toHaveCount(4);
    await letter
      .locator('.para')
      .last()
      .getByRole('button', { name: /Delete paragraph/ })
      .click();
    await expect(letter.locator('.para')).toHaveCount(3);

    // Keyboard-reorder a paragraph (same Alt+Arrow mechanism), announced.
    await letter.locator('.para .grip').first().focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect(page.locator('.sr-only[aria-live]')).toContainText(
      'Paragraph moved to position 2',
    );
  });

  test('cover-letter header + paragraphs persist to the backend when connected', async ({
    page,
  }) => {
    const main = {
      person: { id: 7, name: 'Ada Lovelace' },
      personal: { firstName: 'Ada', lastName: 'Lovelace' },
      sections: [],
      variants: [
        {
          id: 60,
          name: 'Cover Letter',
          kind: 'coverletter',
          rules: { include: [], exclude: [] },
          sections: [],
        },
      ],
      coverletter: { recipientName: 'Globex', opening: 'Dear Team,', closing: 'Sincerely,' },
    };
    await page.route(/\/cv\/api\/persons$/, (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ persons: [{ id: 7, name: 'Ada Lovelace' }] }),
      }),
    );
    await page.route(/\/cv\/api\/persons\/7$/, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(main) }),
    );
    // Letter body: GET loads one paragraph; POST adds another.
    let posted = 0;
    await page.route(/\/cv\/api\/variants\/60\/letter-sections$/, (r) => {
      if (r.request().method() === 'POST') {
        posted += 1;
        return r.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 200 }),
        });
      }
      return r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 100, title: '', body: 'Existing paragraph.' }]),
      });
    });
    // Header PATCH — capture the LaTeX-escaped payload.
    let headerPatch: { recipientName?: string } | null = null;
    await page.route(/\/cv\/api\/persons\/7\/coverletter$/, (r) => {
      headerPatch = r.request().postDataJSON();
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
    });

    await gotoEditor(page);
    await expect(page.locator('.conn')).toContainText('connected');

    await selectVariant(page, 'Cover Letter');
    const letter = page.locator('.letter');
    await expect(letter.locator('.para .body')).toHaveValue('Existing paragraph.');

    // Edit the recipient → debounced PATCH /coverletter, LaTeX-escaped.
    await letter.locator('.fields .in').first().fill('Globex R&D');
    await expect.poll(() => headerPatch?.recipientName).toBe('Globex R\\&D');

    // Add a paragraph → POST /letter-sections.
    await letter.getByRole('button', { name: /Add paragraph/ }).click();
    await expect.poll(() => posted).toBe(1);
  });

  test('exports the résumé as import-compatible JSON (works offline)', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);

    // Confirm the island has hydrated (its click handlers are live) before export.
    const inline = page.locator('.doc .edit');
    await page.locator('.entry').first().click();
    await expect(inline).toBeVisible();
    await page.keyboard.press('Escape');

    // Export downloads a JSON file with the backend's import-compatible shape.
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Export/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);

    const path = await download.path();
    const doc = JSON.parse(await readFile(path, 'utf8')) as {
      sections: { slug: string }[];
      variants: { kind: string }[];
      personal: Record<string, string>;
    };
    expect(doc.sections.map((s) => s.slug)).toContain('experience');
    expect(doc.variants.some((v) => v.kind === 'coverletter')).toBe(true);
    // 'id' in doc.sections[0] would be true for a raw snapshot; the import shape drops it.
    expect('id' in doc.sections[0]).toBe(false);
  });

  test('rolls back an optimistic create when the backend rejects it', async ({ page }) => {
    const main = {
      person: { id: 7, name: 'Ada Lovelace' },
      personal: { firstName: 'Ada', lastName: 'Lovelace' },
      sections: [{ id: 2, type: 'experience', title: 'Experience', entries: [] }],
      variants: [],
    };
    await page.route(/\/cv\/api\/persons$/, (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ persons: [{ id: 7, name: 'Ada Lovelace' }] }),
      }),
    );
    await page.route(/\/cv\/api\/persons\/7$/, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(main) }),
    );
    // The section create fails.
    await page.route(/\/cv\/api\/persons\/7\/sections$/, (r) =>
      r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"nope"}' }),
    );
    await gotoEditor(page);
    await expect(page.locator('.conn')).toContainText('connected');

    await page.locator('.add-section').click();
    await page.locator('.picker .pick').filter({ hasText: 'Skills' }).first().click();

    // The optimistic Skills section is removed (no phantom), and the error surfaces.
    await expect(page.locator('.sec-head h2').filter({ hasText: 'Skills' })).toHaveCount(0);
    await expect(page.locator('.statusbar')).toContainText('save failed');
  });

  test('a failed field save raises a retry toast; retry clears it', async ({ page }) => {
    const main = {
      person: { id: 7, name: 'Ada Lovelace' },
      personal: { firstName: 'Ada', lastName: 'Lovelace' },
      sections: [
        {
          id: 2,
          type: 'experience',
          title: 'Experience',
          entries: [{ id: 11, fields: { position: 'Analyst' }, tags: [], items: [] }],
        },
      ],
      variants: [],
    };
    await page.route(/\/cv\/api\/persons$/, (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ persons: [{ id: 7, name: 'Ada Lovelace' }] }),
      }),
    );
    await page.route(/\/cv\/api\/persons\/7$/, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(main) }),
    );
    // The first PUT fails; the retry (second) succeeds.
    let puts = 0;
    await page.route(/\/cv\/api\/entries\/11$/, (r) => {
      puts += 1;
      return puts === 1
        ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"nope"}' })
        : r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await gotoEditor(page);
    await expect(page.locator('.conn')).toContainText('connected');

    // Edit Position → debounced PUT /entries/11, which fails the first time.
    await page.locator('.entry').first().click();
    const inline = page.locator('.doc .edit');
    await expect(inline).toBeVisible();
    await inline.locator('.fld').first().locator('input').fill('Lead Analyst');

    // The failure surfaces as a toast offering a retry (not just a statusbar tick).
    const toast = page.locator('.save-toast');
    await expect(toast).toContainText("Couldn't save");
    await expect(page.locator('.statusbar')).toContainText('save failed');

    // Retry re-sends the PUT (now 200) → toast clears and the save settles.
    await toast.locator('.st-retry').click();
    await expect(toast).toHaveCount(0);
    await expect(page.locator('.statusbar')).toContainText('saved');
    expect(puts).toBe(2);
  });
});
