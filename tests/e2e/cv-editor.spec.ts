import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { gotoEditor, EDITOR_APP, MINIMAL_PDF, expectInk } from './helpers';

/**
 * Smoke tests for the rewritten document-first CV editor (Svelte island).
 * The editor auto-connects to the live backend on mount, so each test controls
 * that fetch (abort / 403) to stay deterministic and never touch the real gateway.
 */

/** Mock a signed-in profile that owns one no-rules variant ("Full CV", id 50). */
/** The signed-in identity used by every connected test (only sessions connect now). */
const ADA = { email: 'ada@example.com', name: 'Ada Lovelace' };

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

/** Open a menubar pull-down by title. */
/** What the document holds: the editors are the document, so its text is their values. */
const docText = (page: Page) =>
  page.locator('.doc').evaluate((el) =>
    [...el.querySelectorAll('input, textarea')]
      .map((f) => (f as HTMLInputElement | HTMLTextAreaElement).value)
      .concat(el.textContent ?? '')
      .join('\n'),
  );
const expectDoc = (page: Page, text: string) => expect.poll(() => docText(page)).toContain(text);
const expectNotDoc = (page: Page, text: string) =>
  expect.poll(() => docText(page)).not.toContain(text);

/**
 * Drag one sortable row onto another. Playwright's dragTo does not start an HTML5
 * drag from a nested grip, so the three events the binding listens for are
 * dispatched directly — dragstart on the handle, then dragover and drop on the target.
 */
async function dragRow(page: Page, selector: string, from: number, to: number) {
  await page
    .locator(selector)
    .first()
    .evaluate(
      (el, { sel, f, t }) => {
        const rows = [...el.closest('[data-sortable]')!.parentElement!.querySelectorAll(sel)];
        const dt = new DataTransfer();
        const fire = (type: string, node: Element) =>
          node.dispatchEvent(
            new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }),
          );
        fire('dragstart', rows[f].querySelector('[data-drag-handle]') ?? rows[f]);
        fire('dragover', rows[t]);
        fire('drop', rows[t]);
      },
      { sel: selector, f: from, t: to },
    );
}

/** The index of the first row whose fields hold this text (hasText sees no values). */
async function rowWith(page: Page, selector: string, text: string) {
  const rows = page.locator(selector);
  const i = await rows.evaluateAll(
    (els, t) =>
      els.findIndex(
        (el) =>
          [...el.querySelectorAll('input, textarea')].some((f) =>
            (f as HTMLInputElement | HTMLTextAreaElement).value.includes(t),
          ) || (el.textContent ?? '').includes(t),
      ),
    text,
  );
  expect(i, `no ${selector} holding "${text}"`).toBeGreaterThanOrEqual(0);
  return rows.nth(i);
}
const bulletWith = (page: Page, text: string) => rowWith(page, '.doc .edit .bl', text);
const entryWith = (page: Page, text: string) => rowWith(page, '.doc .edit[data-sortable]', text);

/** The editor for one entry, named by the type header it carries. */
const editorFor = (page: Page, type: string | RegExp) =>
  page.locator('.doc .edit').filter({ has: page.locator('.etype', { hasText: type }) });
/** The toolbar's symbols popup: one palette for the whole document. */
async function openSymbols(page: Page) {
  await page.getByRole('button', { name: 'Ω' }).click();
  await expect(page.locator('.sym-window .palette')).toBeVisible();
}
const pickSymbol = (page: Page, glyph: string) =>
  page.locator('.sym-window .palette .sym').filter({ hasText: glyph }).first().click();

/** Undo / Redo name what they will act on, so a test can ask for them by that. */
const undoBtn = (page: Page) => page.getByRole('button', { name: /^Undo/ });
const redoBtn = (page: Page) => page.getByRole('button', { name: /^Redo/ });

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
  test('renders the editor shell and the demo resume', async ({ page }) => {
    // Backend unreachable → editor stays on the local demo.
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);

    // Island hydrated: the System-6 menubar is present.
    await expect(page.locator('.toolbar')).toContainText('Resume');
    // The demo renders the owner's real CV, but its name and contacts come from build-time
    // env (blank here), so assert on the hardcoded professional content.
    await expect(page.getByRole('textbox', { name: 'Organization' }).first()).toHaveValue(
      'Qualcomm Institute (CALIT2)',
    );
    // The editor is an ordinary page: the portal's own chrome frames it.
    await expect(page.locator('.site-menubar')).toBeVisible();
    await expect(page.locator('.title-bar .title')).toHaveText('LaTeX Resume Editor');
    // Signing in is the menubar's; the status bar says only that nothing is saved.
    await expect(page.locator('.site-menubar .auth-btn')).toHaveText('Sign in');
    await expect(page.locator('.toolbar')).toContainText('demo');
    await expect(page.locator('.toolbar')).toContainText('not saved');
    await expect(page.locator('.conn')).toHaveCount(0);
  });

  test('every entry is its own type-aware editor, open from the start', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);

    // Nothing to click open: the personal details and every entry are already editors.
    await expect(editorFor(page, 'Personal details')).toBeVisible();
    const role = editorFor(page, /Experience/).first();
    await expect(role.locator('.lbl', { hasText: 'Position' })).toBeVisible();
    // The editors are the document, so no read-only view is left to return to.
    await expect(page.locator('.doc .entry, .doc .entry-hit')).toHaveCount(0);
    await expect(page.locator('.doc .edit button').filter({ hasText: 'Done' })).toHaveCount(0);
  });

  test('the symbols palette inserts a glyph; an unknown command warns', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);

    const edit = editorFor(page, /Experience/).first();
    await expect(edit).toBeVisible();
    const field = edit.locator('.fld input').first();

    // An unrecognized \command warns that it prints literally…
    await field.fill('Led \\vspace migration');
    await expect(edit.locator('.warn')).toContainText('\\vspace');
    await expect(edit.locator('.warn')).toContainText('print literally');

    // …a recognized one raises no warning.
    await field.fill('scaling n \\rightarrow \\infty');
    await expect(edit.locator('.warn')).toHaveCount(0);

    // The palette inserts the glyph at the caret (fill leaves it at the end).
    await field.fill('AB');
    await field.focus();
    await openSymbols(page);
    await pickSymbol(page, '→');
    await expect(field).toHaveValue('AB→');
  });

  test('the palette + warning also work in the personal-details editor', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);

    const edit = editorFor(page, 'Personal details');
    await expect(edit).toBeVisible();
    const field = edit.locator('.grid .fld input').first();

    await field.fill('Ada');
    await field.focus();
    await openSymbols(page);
    await pickSymbol(page, 'α');
    await expect(field).toHaveValue('Adaα');

    await field.fill('\\nope');
    await expect(edit.locator('.warn')).toContainText('\\nope');
  });

  test('the palette + warning also work in the cover-letter editor', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);
    await selectVariant(page, 'Cover Letter');

    const letter = page.locator('.letter');
    await expect(letter).toBeVisible();
    const field = letter.locator('.fields input').first(); // recipient

    await field.fill('Globex');
    await field.focus();
    await openSymbols(page);
    await pickSymbol(page, '→');
    await expect(field).toHaveValue('Globex→');

    await field.fill('\\zilch');
    await expect(letter.locator('.warn')).toContainText('\\zilch');
  });

  test('a blocked backend reads as an invitation, not a failure', async ({ page }) => {
    // Simulate Cloudflare Access blocking the unauthenticated data probe — the
    // state every visitor lands in, since the backend is owner-only.
    await page.route('**/api/persons', (route) => route.fulfill({ status: 403 }));
    await gotoEditor(page);

    // With the gateway reachable, a 403 means "sign in", not "down": the demo is
    // there to edit, and the menubar offers the way to keep those edits.
    await expectDoc(page, 'Qualcomm Institute (CALIT2)');
    await expect(page.locator('.site-menubar .auth-btn')).toHaveText('Sign in');
    await expect(page.locator('.toolbar')).toContainText('demo');
    await expect(page.locator('.toolbar')).toContainText('not saved');
  });

  test('Edit ▸ Undo restores a typed burst, and Redo puts it back', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);

    // Nothing done yet → both commands are honestly disabled.
    await expect(undoBtn(page)).toBeDisabled();
    await expect(redoBtn(page)).toBeDisabled();
    await page.keyboard.press('Escape');

    const field = editorFor(page, /Experience/)
      .first()
      .locator('.fld input')
      .first();
    await field.fill('Chief Tinkerer');
    await expectDoc(page, 'Chief Tinkerer');

    // The label names what will be undone, and typing collapsed into one command.
    await expect(page.getByRole('button', { name: 'Undo Position' })).toBeEnabled();
    await page.getByRole('button', { name: 'Undo Position' }).click();
    await expectNotDoc(page, 'Chief Tinkerer');
    await expectDoc(page, 'Research Intern');

    // One command covers the fourteen keystrokes: the stack is now empty.
    await expect(undoBtn(page)).toBeDisabled();
    await page.getByRole('button', { name: 'Redo Position' }).click();
    await expectDoc(page, 'Chief Tinkerer');
  });

  test('undo restores a deleted section with its bullets and tags', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);
    page.on('dialog', (d) => d.accept());

    const sections = page.locator('.doc .sec h2');
    await expect(sections).toHaveText(['Summary', 'Experience', 'Skills', 'Education']);

    // The counts are the fixture's; what matters is that undo brings them all back.
    const bulletsBefore = await page.locator('.doc .edit .bl').count();
    const chipsBefore = await page.locator('.doc .edit .bl .chip').count();

    const experience = page
      .locator('.doc .sec')
      .filter({ has: page.locator('h2', { hasText: 'Experience' }) });
    await experience.locator('.tool.danger').click();
    await expect(sections).toHaveText(['Summary', 'Skills', 'Education']);

    // ⌘Z outside a text field drives the document-level undo.
    await page.locator('.title-bar').click();
    await page.keyboard.press('ControlOrMeta+z');

    // Back at its original index, with everything that was inside it.
    await expect(sections).toHaveText(['Summary', 'Experience', 'Skills', 'Education']);
    await expectDoc(page, 'Qualcomm Institute (CALIT2)');
    await expectDoc(page, 'Simulated a noisy quantum channel');
    await expect(page.locator('.doc .edit .bl')).toHaveCount(bulletsBefore);
    await expect(page.locator('.doc .edit .bl .chip')).toHaveCount(chipsBefore);
  });

  test('undoing a delete re-creates the row on the backend', async ({ page }) => {
    // The inverse of a delete is a CREATE, so the server issues a brand-new id.
    // Commands therefore close over the live object, never over a captured id.
    await mockAdaWithVariant(page);
    const calls: string[] = [];
    await page.route(/\/cv\/api\/entries\/11$/, (r) => {
      calls.push(`${r.request().method()} /entries/11`);
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.route(/\/cv\/api\/sections\/2\/entries$/, (r) => {
      calls.push(`${r.request().method()} /sections/2/entries`);
      return r.fulfill({ status: 201, contentType: 'application/json', body: '{"id":99}' });
    });
    await page.route(/\/cv\/api\/sections\/2\/entries\/order$/, (r) => {
      calls.push(`PATCH order ${JSON.stringify(r.request().postDataJSON().ids)}`);
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await gotoEditor(page, EDITOR_APP, { signedIn: ADA });
    await expect(page.getByRole('textbox', { name: 'First name' })).toHaveValue('Ada');

    page.on('dialog', (d) => d.accept());
    await page
      .locator('.doc .edit[data-sortable]')
      .first()
      .getByRole('button', { name: /^Delete / })
      .click();
    await expect(page.locator('.doc .edit[data-sortable]')).toHaveCount(0);

    await page.locator('.title-bar').click();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.locator('.doc .edit[data-sortable]')).toHaveCount(1);
    await expectDoc(page, 'Analyst');

    // DELETE, then a real POST to re-create it — and the order PATCH carries the
    // the new server id (99), replacing the dead one (11).
    await expect
      .poll(() => calls)
      .toEqual(['DELETE /entries/11', 'POST /sections/2/entries', 'PATCH order [99]']);
  });

  test('undo reverts a variant rule, and the lens re-dims live', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);

    const drawer = page.locator('.drawer');
    await page.locator('.toolbar .variant-btn').click();
    await drawer.locator('.opt').filter({ hasText: 'Quantum Research' }).click();

    // Exclude #research → a quantum bullet that also carries it drops out of the lens.
    const researchBullet = await bulletWith(page, 'Simulated a noisy quantum channel');
    await expect(researchBullet.locator('.bl-ins')).not.toHaveClass(/dim/);
    const excludeIn = drawer.locator('.rule').filter({ hasText: 'Exclude' }).locator('.tag-in');
    await excludeIn.fill('research');
    await excludeIn.press('Enter');
    await expect(researchBullet.locator('.bl-ins')).toHaveClass(/dim/);

    // The Edit menu names the exact rule; undoing it lifts the veto and re-dims live.
    await page.keyboard.press('Escape'); // close the drawer so ⌘Z isn't inside the chip input
    await expect(page.getByRole('button', { name: 'Undo Exclude #research' })).toBeEnabled();
    await page.getByRole('button', { name: 'Undo Exclude #research' }).click();
    await expect(researchBullet).not.toHaveClass(/dim/);
  });

  test('undo reverts a style change, and re-themes the document live', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);

    await page.locator('.tb-doc .btn', { hasText: 'Style' }).click();
    const drawer = page.locator('.drawer');
    await expect(drawer.locator('.swatch')).toHaveCount(9);

    const originally = await drawer.locator('.swatch.on').getAttribute('aria-label');
    const target = drawer.locator('.swatch:not(.on)').first();
    const targetLabel = await target.getAttribute('aria-label');
    await target.click();
    await expect(drawer.locator('.swatch.on')).toHaveAttribute('aria-label', targetLabel!);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Undo Accent color' })).toBeEnabled();
    await page.getByRole('button', { name: 'Undo Accent color' }).click();

    // Reopen Style: the original swatch is selected again.
    await page.locator('.tb-doc .btn', { hasText: 'Style' }).click();
    await expect(drawer.locator('.swatch.on')).toHaveAttribute('aria-label', originally!);
  });

  test('deleting a variant clears the undo history', async ({ page }) => {
    // A rule command points at the variant's server row; once the variant is gone,
    // undoing it would write to a dead row — so the delete forgets the history.
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);
    page.on('dialog', (d) => d.accept());

    const drawer = page.locator('.drawer');
    await page.locator('.toolbar .variant-btn').click();
    await drawer.locator('.opt').filter({ hasText: 'Quantum Research' }).click();
    const excludeIn = drawer.locator('.rule').filter({ hasText: 'Exclude' }).locator('.tag-in');
    await excludeIn.fill('research');
    await excludeIn.press('Enter');

    // History has the rule command…
    await page.keyboard.press('Escape');
    await expect(undoBtn(page)).toBeEnabled();
    await page.keyboard.press('Escape');

    // …deleting the variant clears it.
    await page.locator('.toolbar .variant-btn').click();
    await drawer.locator('.del').click();
    await page.keyboard.press('Escape');
    await expect(undoBtn(page)).toBeDisabled();
  });

  test('undo history survives a resume switch and back', async ({ page }) => {
    // Each profile keeps its own history, and returning reuses the cached tree
    // (no refetch) so the commands — which hold that tree's objects — stay valid.
    const ada = {
      person: { id: 8, name: 'Ada Lovelace' },
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
    const grace = {
      person: { id: 7, name: 'Grace Hopper' },
      personal: { firstName: 'Grace', lastName: 'Hopper' },
      sections: [
        {
          id: 3,
          type: 'experience',
          title: 'Experience',
          entries: [{ id: 21, fields: { position: 'Admiral' }, tags: [], items: [] }],
        },
      ],
      variants: [],
    };
    await page.route(/\/cv\/api\/persons$/, (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          persons: [
            { id: 7, name: 'Grace Hopper' },
            { id: 8, name: 'Ada Lovelace' },
          ],
        }),
      }),
    );
    let adaGets = 0;
    await page.route(/\/cv\/api\/persons\/8$/, (r) => {
      adaGets += 1; // count refetches of Ada — a cache hit must not add one
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ada) });
    });
    await page.route(/\/cv\/api\/persons\/7$/, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(grace) }),
    );
    await page.route(/\/cv\/api\/entries\/\d+$/, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );
    await gotoEditor(page, EDITOR_APP, { signedIn: ADA });

    // fetchActive defaults to the highest id → Ada (8). Edit her position field.
    await expect(page.getByRole('textbox', { name: 'First name' })).toHaveValue('Ada');
    await editorFor(page, /Experience/)
      .first()
      .locator('.fld input')
      .first()
      .fill('Chief Analyst');
    await expectDoc(page, 'Chief Analyst');

    // Switch to Grace: a different profile, her own (empty) history.
    await page.locator('.toolbar .profile-btn').click();
    await page.locator('.drawer .opt').filter({ hasText: 'Grace Hopper' }).click();
    await page.keyboard.press('Escape');
    await expectDoc(page, 'Admiral');
    await expect(undoBtn(page)).toBeDisabled();
    await page.keyboard.press('Escape');

    // Back to Ada — from cache (adaGets stays 1) — with her edit AND her undo intact.
    await page.locator('.toolbar .profile-btn').click();
    await page.locator('.drawer .opt').filter({ hasText: 'Ada Lovelace' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('textbox', { name: 'Last name' })).toHaveValue('Lovelace');
    expect(adaGets).toBe(1); // cache hit — no refetch
    await expectDoc(page, 'Chief Analyst');

    await expect(page.getByRole('button', { name: 'Undo Position' })).toBeEnabled();
    await page.getByRole('button', { name: 'Undo Position' }).click();
    await expectDoc(page, 'Analyst');
    await expectNotDoc(page, 'Chief Analyst');
  });

  test('the toolbar toggles the preview pane and opens the panels', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);

    // The pane is open from the start, and the button is a toggle that says so
    // through aria-pressed, which a screen reader reads as state.
    const preview = page.getByRole('button', { name: /Preview/ });
    await expect(page.locator('.preview')).toBeVisible();
    await expect(preview).toHaveAttribute('aria-pressed', 'true');
    await preview.click();
    await expect(page.locator('.preview')).toHaveCount(0);
    await expect(preview).toHaveAttribute('aria-pressed', 'false');
    await preview.click();
    await expect(page.locator('.preview')).toBeVisible();

    await page.getByRole('button', { name: 'Tags' }).click();
    await expect(page.locator('.drawer[aria-label="Tags"]')).toBeVisible();
  });

  test('loads and renders a real resume when authenticated', async ({ page }) => {
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
    await gotoEditor(page, EDITOR_APP, { signedIn: ADA });

    await expect(page.getByRole('textbox', { name: 'First name' })).toHaveValue('Ada');
    await expectDoc(page, 'Analytical Engine Co');
    await expectDoc(page, 'Wrote the first algorithm');
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
    await gotoEditor(page, EDITOR_APP, { signedIn: ADA });

    const inline = editorFor(page, /Experience/).first();
    await expect(inline).toBeVisible();

    // Edit Position with a '%' → debounced PUT /entries/11 with it escaped to '\%'.
    await inline.locator('.fld').first().locator('input').fill('Lead 50%');
    await expect(page.locator('.toolbar')).toContainText('✓ saved', { timeout: 5000 });
    await expect.poll(() => putBody?.fields?.position).toBe('Lead 50\\%');
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
    await gotoEditor(page, EDITOR_APP, { signedIn: ADA });

    await page.locator('.add-section').click();
    await page.locator('.picker .pick').filter({ hasText: 'Skills' }).first().click();

    await expect.poll(() => postBody?.type).toBe('skills');
    await expect.poll(() => postBody?.slug).toBe('skills');
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
    await gotoEditor(page, EDITOR_APP, { signedIn: ADA });

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
    await gotoEditor(page, EDITOR_APP, { signedIn: ADA });

    const entries = page.locator('.sec .edit[data-sortable]');
    await expect(entries).toHaveCount(2);
    // Drag the 2nd entry (Beta / id 12) onto the 1st (Alpha / id 11) → [12, 11].
    // The grip is what the sortable binding listens on.
    await dragRow(page, '.sec > .edit[data-sortable]', 1, 0);
    await expect.poll(() => orderBody?.ids).toEqual([12, 11]);
  });

  test('toolbar opens and closes the drawers', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);
    await expect(page.locator('.toolbar')).toContainText('Resume');

    // Style drawer — accent swatches; close box dismisses.
    await page.getByRole('button', { name: 'Style', exact: true }).click();
    await expect(page.locator('.drawer')).toBeVisible();
    await expect(page.locator('.drawer')).toContainText('Accent color');
    await expect(page.locator('.drawer .swatch')).toHaveCount(9);
    await page.locator('.drawer .close').click();
    await expect(page.locator('.drawer')).toHaveCount(0);

    // Layout needs the backend to pick a template, so signed out it is out of reach.
    await expect(page.getByRole('button', { name: 'Layout', exact: true })).toBeDisabled();

    // Tags drawer — the spotlight note; close box dismisses.
    await page.getByRole('button', { name: 'Tags', exact: true }).click();
    await expect(page.locator('.drawer')).toContainText('spotlight where it');
    await page.locator('.drawer .close').click();
    await expect(page.locator('.drawer')).toHaveCount(0);
  });

  test('tags drawer spotlights matching entries; chips edit tags inline', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);
    await expect(page.locator('.toolbar')).toContainText('Resume');

    // The demo profile's baked-in vocabulary surfaces with usage counts
    // (#leadership sits on 2 entries + 2 bullets → 4).
    const drawer = page.locator('.drawer');
    await page.getByRole('button', { name: 'Tags', exact: true }).click();
    await expect(drawer).toBeVisible();
    const leadershipRow = drawer.locator('.row', { hasText: 'leadership' });
    await expect(leadershipRow).toContainText('4');

    // Spotlight #leadership: entries carrying it stay lit, the untagged summary dims.
    await leadershipRow.click();
    await expect(editorFor(page, /Paragraph/)).toHaveClass(/dim/);
    await expect(await entryWith(page, 'ACM Cyber')).not.toHaveClass(/dim/);

    // Clearing the spotlight restores everything.
    await drawer.locator('.clear').click();
    await expect(editorFor(page, /Paragraph/)).not.toHaveClass(/dim/);
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);

    // Inline chips: the untagged entry takes a tag and gives it back.
    const inline = await entryWith(page, 'December 2024');
    await expect(inline).toBeVisible();

    const tagIn = inline.locator('.tags-row .tag-in');
    await tagIn.fill('honors');
    await tagIn.press('Enter');
    await expect(inline.locator('.tags-row .chip').first()).toContainText('#honors');

    await inline.locator('.tags-row .chip .cx').click();
    await expect(inline.locator('.tags-row .chip')).toHaveCount(0);
  });

  test('the variant drawer applies a lens that dims excluded content', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);
    await expect(page.locator('.toolbar')).toContainText('Resume');

    // Open the Variants drawer from the toolbar popup.
    const drawer = page.locator('.drawer');
    await page.locator('.toolbar .variant-btn').click();
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('lens on your main');
    // The demo ships CV variants with live "shows X of Y" counts.
    await expect(drawer.locator('.opt').filter({ hasText: 'Quantum Research' })).toContainText(
      '2/11',
    );

    // Applying it dims the untagged summary while a #quantum entry stays lit.
    await drawer.locator('.opt').filter({ hasText: 'Quantum Research' }).click();
    await expect(editorFor(page, /Paragraph/)).toHaveClass(/dim/);
    await expect(await entryWith(page, 'Real-time video encryption')).not.toHaveClass(/dim/);
    // The lens reaches into bullets: a non-#quantum bullet drops inside a lit entry.
    await expect(
      (await bulletWith(page, 'Presented algorithmic research')).locator('.bl-ins'),
    ).toHaveClass(/dim/);

    // Editing a rule updates the lens live: excluding #research vetoes a lit bullet.
    const excludeIn = drawer.locator('.rule').filter({ hasText: 'Exclude' }).locator('.tag-in');
    await excludeIn.fill('research');
    await excludeIn.press('Enter');
    await expect(
      (await bulletWith(page, 'Simulated a noisy quantum channel')).locator('.bl-ins'),
    ).toHaveClass(/dim/);

    // Back to Main clears the lens entirely.
    await drawer.locator('.opt').filter({ hasText: 'Main' }).click();
    await expect(page.locator('.doc .dim')).toHaveCount(0);
  });

  test('skills edit as items: add and tag a skill, and see it in the document (demo)', async ({
    page,
  }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);

    // A cvskills group now opens the bullet editor — each skill is its own item row.
    const edit = editorFor(page, /Skills/).first();
    await expect(edit).toBeVisible();
    await expect(edit.locator('.bl')).toHaveCount(5); // Python … SQL
    // The add control is relabelled by the type's itemLabel ("Skill", not "Bullet").
    await expect(edit.locator('.mini.add')).toHaveText(/skill/i);

    // Add a skill, type into the new row.
    await edit.locator('.mini.add').click();
    await expect(edit.locator('.bl')).toHaveCount(6);
    await edit.locator('.bl .bl-content').last().fill('Rust');

    // Per-skill tags — the whole point of promoting skills to items.
    const firstTagIn = edit.locator('.bl').first().locator('.tag-in');
    await firstTagIn.fill('systems');
    await firstTagIn.press('Enter');
    await expect(edit.locator('.bl').first().locator('.chip')).toContainText('#systems');

    await expect(await entryWith(page, 'Rust')).toBeVisible();
  });

  test('a variant field edit writes an override (not the base), shown live; reset restores Main', async ({
    page,
  }) => {
    await mockAdaWithVariant(page);
    const overrides: Array<Record<string, unknown>> = [];
    await page.route(/\/cv\/api\/variants\/50\/overrides$/, (r) => {
      overrides.push(r.request().postDataJSON());
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
    });
    // A base field write would go here — it must not fire while a variant is active.
    let baseWrites = 0;
    await page.route(/\/cv\/api\/entries\/11$/, (r) => {
      baseWrites += 1;
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await gotoEditor(page, EDITOR_APP, { signedIn: ADA });
    await selectFullCV(page);

    // The entry editor announces the mode unmistakably.
    const edit = editorFor(page, /Experience/).first();
    await expect(edit.locator('.vmode')).toContainText('Full CV');

    // Editing Position writes a per-variant fields_override and leaves the base entry alone.
    await edit.locator('.fld').first().locator('input').fill('Senior Analyst');
    await expect
      .poll(() => overrides.at(-1))
      .toMatchObject({
        targetType: 'entry',
        targetId: 11,
        fieldsOverride: { position: 'Senior Analyst' },
      });

    // The lens shows it live; the base was never written.
    await expectDoc(page, 'Senior Analyst');
    expect(baseWrites).toBe(0);

    // Reopen → the field carries a "reset to Main"; using it clears the override.
    await edit.locator('.fld').first().locator('.ov-reset').click();
    await expect.poll(() => overrides.at(-1)?.fieldsOverride).toBeNull();
    await expectDoc(page, 'Analyst');
    await expect(page.locator('.doc .edit[data-sortable]').first()).not.toContainText(
      'Senior Analyst',
    );
  });

  test('a variant can hide a single skill: the item override dims it in-document', async ({
    page,
  }) => {
    const main = {
      person: { id: 7, name: 'Ada Lovelace' },
      personal: { firstName: 'Ada', lastName: 'Lovelace' },
      sections: [
        {
          id: 3,
          type: 'skills',
          title: 'Skills',
          entries: [
            {
              id: 20,
              fields: { category: 'Languages' },
              tags: [],
              items: [
                { id: 200, content: 'Python', tags: [] },
                { id: 201, content: 'Rust', tags: [] },
              ],
            },
          ],
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
    const overrides: Array<Record<string, unknown>> = [];
    await page.route(/\/cv\/api\/variants\/50\/overrides$/, (r) => {
      overrides.push(r.request().postDataJSON());
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
    });
    await gotoEditor(page, EDITOR_APP, { signedIn: ADA });
    await selectFullCV(page);

    // Open the skills group; in variant mode each skill gets a Follow-tags / Force-show /
    // Force-hide control.
    const edit = editorFor(page, /Skills/).first();
    await expect(edit.locator('.vmode')).toBeVisible();
    const python = edit.locator('.bl.ro').filter({ hasText: 'Python' });
    await python.getByRole('button', { name: 'Force hide' }).click();

    // The item override persists as targetType:item, force-out (included:false).
    await expect
      .poll(() => overrides.at(-1))
      .toMatchObject({ targetType: 'item', targetId: 200, included: false });

    // Close → the hidden skill dims in the document while the other stays lit.
    await expect((await bulletWith(page, 'Python')).locator('.bl-ins')).toHaveClass(/dim/);
    await expect((await bulletWith(page, 'Rust')).locator('.bl-ins')).not.toHaveClass(/dim/);
  });

  test('the demo preview shows the published resume, and says it is not yours', async ({
    page,
  }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);
    await expect(page.locator('.toolbar')).toContainText('Resume');

    // A visitor with no account still sees a finished PDF beside the document —
    // the one the site publishes, which the bar names so the two aren't confused.
    const preview = page.locator('.preview');
    await expect(preview).toBeVisible();
    await expect(preview.locator('.pv-pages canvas')).toHaveCount(2);
    await expectInk(preview.locator('.pv-pages canvas').first());
    await expect(preview.locator('.pv-bar')).toContainText("The site's published resume");
    await expect(preview.locator('.pv-bar')).toContainText('not your edits');
    // Downloaded from the gateway, so the browser keeps the dated name it sends.
    await expect(preview.getByRole('link', { name: /PDF/ })).toHaveAttribute(
      'href',
      /\/resume\.pdf$/,
    );
    // Compiling the document being edited is still what needs an account.
    await expect(page.locator('.tb-pdf').getByRole('button', { name: /Compile/ })).toBeDisabled();

    // Once the visitor edits, the two documents have parted: say so over the pages,
    // where someone looking at the PDF will see it.
    await expect(preview.locator('.pv-strip')).toHaveCount(0);
    const entry = await entryWith(page, 'UC San Diego');
    await entry.locator('textarea, input').first().fill('Edited by a visitor.');
    await expect(preview.locator('.pv-strip')).toContainText("Your edits aren't in this PDF");
    // The strip is a band above the pages, so the pages keep the pane's full width.
    const fills = await preview.evaluate((pane) => {
      const page = pane.querySelector('.pv-pages canvas')!.getBoundingClientRect().width;
      return page > pane.getBoundingClientRect().width * 0.8;
    });
    expect(fills).toBe(true);
  });

  test('the demo preview falls back to the sign-in note when the PDF will not load', async ({
    page,
  }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page, EDITOR_APP, { publishedPdf: false });

    const preview = page.locator('.preview');
    await expect(preview).toContainText('Sign in to compile');
    await expect(preview.locator('.pv-pages canvas')).toHaveCount(0);
  });

  test('compiles the active variant to a PDF blob in the preview', async ({ page }) => {
    await mockAdaWithVariant(page);
    let pdfHits = 0;
    await page.route(/\/cv\/api\/variants\/50\/pdf$/, (r) => {
      pdfHits += 1;
      return r.fulfill({ status: 200, contentType: 'application/pdf', body: MINIMAL_PDF });
    });
    await gotoEditor(page, EDITOR_APP, { signedIn: ADA });
    await selectFullCV(page);

    const preview = page.locator('.preview');
    await page
      .locator('.tb-pdf')
      .getByRole('button', { name: /Compile/ })
      .click();

    // The PDF renderer paints one <canvas> per page into the pane (the 2-page fixture → 2).
    await expect(preview.locator('.pv-pages canvas')).toHaveCount(2);
    await expectInk(preview.locator('.pv-pages canvas').first());
    // The pane scrolls internally (pages taller than the viewport-capped column) rather
    // than growing the shell — guards the "doesn't reach the bottom" regression.
    const scrolls = await preview
      .locator('.pv-pages')
      .evaluate(
        (el) => el.scrollHeight > el.clientHeight + 4 && el.clientHeight <= window.innerHeight,
      );
    expect(scrolls).toBe(true);
    await expect.poll(() => pdfHits).toBe(1);
    // The download link carries the dated name: day, whose CV, which variant.
    await expect(preview.getByRole('link', { name: /PDF/ })).toHaveAttribute(
      'download',
      /^\d{4}-\d{2}-\d{2}-Ada-Lovelace-Full-CV\.pdf$/,
    );
  });

  test('compiles the Main document via the base-compile route', async ({ page }) => {
    await mockAdaWithVariant(page);
    let mainHits = 0;
    // No variant selected → the editor stays on "Main" (the full document), which now
    // compiles through the person-keyed base-compile route.
    await page.route(/\/cv\/api\/variants\/main\/7\/pdf$/, (r) => {
      mainHits += 1;
      return r.fulfill({ status: 200, contentType: 'application/pdf', body: MINIMAL_PDF });
    });
    await gotoEditor(page, EDITOR_APP, { signedIn: ADA });

    const preview = page.locator('.preview');
    await page
      .locator('.tb-pdf')
      .getByRole('button', { name: /Compile/ })
      .click();

    await expect(preview.locator('.pv-pages canvas').first()).toBeVisible();
    await expect.poll(() => mainHits).toBe(1);
    // Same shape for the base document, with Main as the variant.
    await expect(preview.getByRole('link', { name: /PDF/ })).toHaveAttribute(
      'download',
      /^\d{4}-\d{2}-\d{2}-Ada-Lovelace-Main\.pdf$/,
    );
  });

  test('the toolbar Compile button opens the pane and compiles (no Preview click first)', async ({
    page,
  }) => {
    await mockAdaWithVariant(page);
    let hits = 0;
    await page.route(/\/cv\/api\/variants\/main\/7\/pdf$/, (r) => {
      hits += 1;
      return r.fulfill({ status: 200, contentType: 'application/pdf', body: MINIMAL_PDF });
    });
    await gotoEditor(page, EDITOR_APP, { signedIn: ADA });

    // Close the pane first, so the reveal is part of what Compile is shown to do.
    await page.getByRole('button', { name: /Preview/ }).click();
    await expect(page.locator('.preview')).toHaveCount(0);

    // Compile straight from the toolbar — the pane opens and renders the PDF, no
    // separate "open Preview first" step.
    await page
      .locator('.tb-pdf')
      .getByRole('button', { name: /Compile/ })
      .click();
    const preview = page.locator('.preview');
    await expect(preview).toBeVisible();
    await expect(preview.locator('.pv-pages canvas').first()).toBeVisible();
    await expect.poll(() => hits).toBe(1);
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
    await gotoEditor(page, EDITOR_APP, { signedIn: ADA });
    await selectFullCV(page);

    const preview = page.locator('.preview');
    await page
      .locator('.tb-pdf')
      .getByRole('button', { name: /Compile/ })
      .click();

    await expect(preview.locator('.pv-log')).toContainText('Undefined control sequence');
    await expect(preview.locator('.pv-pages')).toHaveCount(0);
  });

  test('switching resumes is out of reach in demo, and says why', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);
    await expect(page.locator('.toolbar')).toContainText('Resume');

    // Switching resumes needs the account that holds them. The control keeps its
    // place in the tab order and carries the reason, and a click does nothing.
    const btn = page.locator('.toolbar .profile-btn');
    await expect(btn).toBeDisabled();
    await expect(btn).toHaveAttribute('title', /sign in to switch/i);
    await btn.click({ force: true });
    await expect(page.locator('.drawer')).toHaveCount(0);
  });

  test('creates, renames, and deletes a resume when connected', async ({ page }) => {
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
      person: { id: 8, name: 'New resume' },
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

    await gotoEditor(page, EDITOR_APP, { signedIn: ADA });

    const drawer = page.locator('.drawer');
    await page.locator('.toolbar .profile-btn').click();
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('.opt')).toHaveCount(1);

    // Create → a new empty profile appears, is selected, and loads (blank doc-head).
    await drawer.getByRole('button', { name: /New resume/ }).click();
    await expect(drawer.locator('.opt')).toHaveCount(2);
    await expect(page.getByRole('textbox', { name: 'First name' })).toHaveValue('');

    // Rename the new profile's label via the drawer.
    const nameInput = drawer.locator('.rename .in');
    await nameInput.fill('Backend Resume');
    await nameInput.blur();
    await expect.poll(() => renamedTo).toBe('Backend Resume');
    await expect(drawer.locator('.opt').filter({ hasText: 'Backend Resume' })).toBeVisible();

    // Delete it (confirmed) → back to Ada.
    await drawer.getByRole('button', { name: /Delete resume/ }).click();
    await expect.poll(() => deleted).toBe(true);
    await expect(drawer.locator('.opt')).toHaveCount(1);
    await expect(page.getByRole('textbox', { name: 'First name' })).toHaveValue('Ada');
  });

  test('deleting the last resume shows an empty state and lets you start over', async ({
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

    await gotoEditor(page, EDITOR_APP, { signedIn: ADA });

    const drawer = page.locator('.drawer');
    await page.locator('.toolbar .profile-btn').click();
    await expect(drawer).toBeVisible();

    // Delete the only profile → the connected empty state (not a sign-in prompt).
    await drawer.getByRole('button', { name: /Delete resume/ }).click();
    await expect(page.locator('.no-profiles')).toContainText('No resumes yet');
    await expect(page.locator('.doc .edit')).toHaveCount(0);

    // Close the drawer, then create from the empty state → editing resumes.
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await page.locator('.no-profiles .np-btn').click();
    await expect(page.locator('.no-profiles')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'First name' })).toHaveValue('');
  });

  test('reorders with the keyboard (Alt+Arrow), keeps focus, and announces', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);
    await expect(page.locator('.toolbar')).toContainText('Resume');

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

    // Entries reorder from their own grip, as sections do.
    const entries = page.locator('.doc .sec').first().locator('.edit[data-sortable]');
    const firstField = entries.first().locator('.fld input').first();
    const firstValue = await firstField.inputValue();
    await entries.first().locator('.egrip').focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect(entries.nth(1).locator('.fld input').first()).toHaveValue(firstValue);
  });

  test('a cover-letter variant switches the editor to letter mode', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);
    await expect(page.locator('.toolbar')).toContainText('Resume');

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
      // legacy person-level header — the new frontend reads the variant's instead of this
      coverletter: { recipientName: 'Legacy Person Header' },
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
    // The letter loads via GET /variants/60 (header + paragraphs together); POST adds one.
    let posted = 0;
    await page.route(/\/cv\/api\/variants\/60$/, (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 60,
          name: 'Cover Letter',
          kind: 'coverletter',
          rules: { include: [], exclude: [] },
          header: { recipientName: 'Globex', opening: 'Dear Team,', closing: 'Sincerely,' },
          letterSections: [{ id: 100, title: '', body: 'Existing paragraph.' }],
        }),
      }),
    );
    await page.route(/\/cv\/api\/variants\/60\/letter-sections$/, (r) => {
      if (r.request().method() === 'POST') {
        posted += 1;
        return r.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 200 }),
        });
      }
      return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    // Per-variant header PATCH — capture the LaTeX-escaped payload.
    let headerPatch: { recipientName?: string } | null = null;
    await page.route(/\/cv\/api\/variants\/60\/header$/, (r) => {
      headerPatch = r.request().postDataJSON();
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
    });

    await gotoEditor(page, EDITOR_APP, { signedIn: ADA });

    await selectVariant(page, 'Cover Letter');
    const letter = page.locator('.letter');
    await expect(letter.locator('.para .body')).toHaveValue('Existing paragraph.');
    // the header comes from the variant (GET /variants/60) rather than the person
    await expect(letter.locator('.fields .in').first()).toHaveValue('Globex');

    // Edit the recipient → debounced PATCH /variants/60/header, LaTeX-escaped.
    await letter.locator('.fields .in').first().fill('Globex R&D');
    await expect.poll(() => headerPatch?.recipientName).toBe('Globex R\\&D');

    // Add a paragraph → POST /letter-sections.
    await letter.getByRole('button', { name: /Add paragraph/ }).click();
    await expect.poll(() => posted).toBe(1);
  });

  test('exports the resume as import-compatible JSON (works offline)', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);

    // Confirm the island has hydrated (its click handlers are live) before export.
    const inline = editorFor(page, /Experience/).first();
    await expect(inline).toBeVisible();
    await page.keyboard.press('Escape');

    // Export downloads a JSON file with the backend's import-compatible shape.
    await page.getByRole('button', { name: /Export/ }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.export-window').getByRole('button', { name: /^JSON/ }).click();
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
    await gotoEditor(page, EDITOR_APP, { signedIn: ADA });

    await page.locator('.add-section').click();
    await page.locator('.picker .pick').filter({ hasText: 'Skills' }).first().click();

    // The optimistic Skills section is removed (no phantom), and the error surfaces.
    await expect(page.locator('.sec-head h2').filter({ hasText: 'Skills' })).toHaveCount(0);
    await expect(page.locator('.toolbar')).toContainText('save failed');
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

    await gotoEditor(page, EDITOR_APP, { signedIn: ADA });

    // Edit Position → debounced PUT /entries/11, which fails the first time.
    const inline = editorFor(page, /Experience/).first();
    await expect(inline).toBeVisible();
    await inline.locator('.fld').first().locator('input').fill('Lead Analyst');

    // The failure surfaces as a toast offering a retry (not just a statusbar tick).
    const toast = page.locator('.save-toast');
    await expect(toast).toContainText("Couldn't save");
    await expect(page.locator('.toolbar')).toContainText('save failed');

    // Retry re-sends the PUT (now 200) → toast clears and the save settles.
    await toast.locator('.st-retry').click();
    await expect(toast).toHaveCount(0);
    await expect(page.locator('.toolbar')).toContainText('✓ saved');
    expect(puts).toBe(2);
  });

  test('self-hosted session: signed-out shows the Google sign-in CTA, no account menu', async ({
    page,
  }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page); // gotoEditor defaults /auth/me → 401 (signed out)
    await expect(page.locator('.site-menubar .auth-btn')).toHaveText('Sign in');
  });

  test('signed in: the account menu shows the identity and Sign out drops the session', async ({
    page,
  }) => {
    await page.route(/\/cv\/api\/persons$/, (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ persons: [{ id: 9, name: 'Ada Lovelace' }] }),
      }),
    );
    await page.route(/\/cv\/api\/persons\/9$/, (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          person: { id: 9, name: 'Ada Lovelace' },
          personal: { firstName: 'Ada', lastName: 'Lovelace' },
          sections: [],
          variants: [],
        }),
      }),
    );
    let loggedOut = false;
    await page.route('**/auth/logout', (r) => {
      loggedOut = true;
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await gotoEditor(page, EDITOR_APP, {
      signedIn: { email: 'ada@example.com', name: 'Ada Lovelace' },
    });

    // The menubar names the account it would sign out of, and does the signing out.
    const account = page.locator('.site-menubar .auth-btn');
    await expect(account).toHaveText('Sign out');
    await expect(account).toHaveAttribute('title', /ada@example\.com/);
    await account.click();
    await expect.poll(() => loggedOut).toBe(true);
  });
});

// "Sign in with Google to keep your edits" must keep them. The login
// round trip is mocked (the gateway 302s straight back); the new account is empty,
// so the editor offers the stashed demo edits and imports them as a profile.
test.describe('Tag suggestions', () => {
  test('a paused bullet shows suggested tags; one click adds one and both choices are reported', async ({
    page,
  }) => {
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
              fields: { position: 'Analyst' },
              tags: [],
              items: [{ id: 31, content: 'Built a REST API in Python', tags: [] }],
            },
          ],
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
    const suggested = ['python', 'backend', 'postgresql'].map((tag, i) => ({
      tag,
      score: 0.45 - i / 100,
    }));
    await page.route(/\/cv\/api\/persons\/7\/tags\/suggest$/, (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ query: '', results: suggested }),
      }),
    );
    const events: unknown[] = [];
    await page.route(/\/cv\/api\/persons\/7\/tags\/events$/, (r) => {
      events.push(...r.request().postDataJSON().events);
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
    });
    const added: unknown[] = [];
    await page.route(/\/cv\/api\/items\/31\/tags$/, (r) => {
      added.push(r.request().postDataJSON().tags);
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await gotoEditor(page, EDITOR_APP, { signedIn: ADA });
    await expect(page.getByRole('textbox', { name: 'First name' })).toHaveValue('Ada');

    const bullet = page.locator('.doc .edit .bl').first();
    await bullet.locator('.bl-content').focus();
    const add = bullet.getByRole('button', { name: 'Add suggested tag python' });
    await expect(add).toBeVisible();
    await expect(bullet.locator('.sug')).toHaveCount(3);

    await add.click();
    await expect(bullet.locator('.chip', { hasText: '#python' })).toBeVisible();
    await bullet.getByRole('button', { name: 'Dismiss suggestion backend' }).click();
    await expect(bullet.locator('.sug')).toHaveCount(1);

    await expect.poll(() => added).toEqual([['python']]);
    await expect
      .poll(() => events)
      .toEqual([
        expect.objectContaining({
          target: 'item',
          id: 31,
          tag: 'python',
          action: 'accept',
          rank: 0,
        }),
        expect.objectContaining({
          target: 'item',
          id: 31,
          tag: 'backend',
          action: 'dismiss',
          rank: 0,
        }),
      ]);
  });

  test('the demo (no backend) never asks for suggestions', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    // Answer the suggest endpoint anyway, so only the offline check can keep chips away.
    let asked = 0;
    await page.route(/\/tags\/suggest$/, (r) => {
      asked++;
      return r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ query: '', results: [{ tag: 'python', score: 0.5 }] }),
      });
    });
    await gotoEditor(page);
    await page.locator('.doc .edit .bl-content').first().focus();
    await page.waitForTimeout(1000);
    await expect(page.locator('.doc .edit .sug')).toHaveCount(0);
    expect(asked).toBe(0);
  });
});

test.describe('Demo edits survive sign-in', () => {
  test('edit → sign in → offered → imported into a new profile', async ({ page }) => {
    await gotoEditor(page);
    // Make an edit the demo tracks (the section-reorder shortcut marks it dirty).
    await page.locator('[aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"]').first().focus();
    await page.keyboard.press('Alt+ArrowDown');

    // From here on the visitor is "signed in" with an empty account.
    await page.unroute('**/auth/me');
    await page.route('**/auth/me', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: true, email: 'ada@example.com', name: 'Ada' }),
      }),
    );
    await page.route('**/auth/login**', (r) =>
      r.fulfill({ status: 302, headers: { location: page.url() } }),
    );
    let persons: { id: number; name: string }[] = [];
    let importBody: Record<string, unknown> | null = null;
    await page.route(/\/cv\/api\/persons$/, (r) => {
      if (r.request().method() === 'POST') {
        persons = [{ id: 9, name: 'Ada (from demo)' }];
        return r.fulfill({ status: 201, contentType: 'application/json', body: '{"id":9}' });
      }
      return r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ persons }),
      });
    });
    await page.route(/\/cv\/api\/persons\/9\/import$/, (r) => {
      importBody = r.request().postDataJSON() as Record<string, unknown>;
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
    });
    await page.route(/\/cv\/api\/persons\/9$/, (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          person: { id: 9, name: 'Ada (from demo)' },
          personal: { firstName: 'Ada' },
          sections: [],
          variants: [],
        }),
      }),
    );

    await page.locator('.site-menubar .auth-btn').click();
    const offer = page.getByRole('dialog', { name: 'Your demo edits' });
    await expect(offer).toBeVisible({ timeout: 15000 });
    await offer.getByRole('button', { name: 'Bring them in' }).click();
    await expect(offer).toBeHidden();
    expect(importBody).not.toBeNull();
    const personal = (importBody as unknown as { personal: Record<string, string> }).personal;
    expect(personal.email).toBe('ada@example.com');
    expect(personal.github).toBeUndefined();
  });
});

// Signed in but the backend didn't answer is its own state (not "Sign in" again),
// and a phone still says the demo isn't saved.
test.describe('Editor state copy', () => {
  test('signed in with an unreachable backend offers a retry, not another sign-in', async ({
    page,
  }) => {
    await page.route(/\/cv\/api\/persons$/, (r) => r.fulfill({ status: 503 }));
    await page.route('**/health', (r) => r.fulfill({ status: 503 }));
    await gotoEditor(page, EDITOR_APP, {
      signedIn: { email: 'ada@example.com', name: 'Ada' },
      offline: true,
    });
    await expect(page.locator('.conn')).toContainText("Couldn't load your resumes");
    // Offering a sign-in to someone already signed in would just loop, so the
    // menubar says Sign out and the retry is the only thing on offer.
    await expect(page.locator('.site-menubar .auth-btn')).toHaveText('Sign out');
    // Nothing compiles in this state either, so the pane shows the published PDF.
    await expectInk(page.locator('.preview .pv-pages canvas').first());
  });

  test('signed in and offline is never told to sign in', async ({ page }) => {
    await page.route(/\/cv\/api\/persons$/, (r) => r.fulfill({ status: 503 }));
    await page.route('**/health', (r) => r.fulfill({ status: 503 }));
    await gotoEditor(page, EDITOR_APP, {
      signedIn: { email: 'ada@example.com', name: 'Ada' },
      offline: true,
      publishedPdf: false,
    });
    const preview = page.locator('.preview');
    await expect(preview).toContainText("Couldn't reach the compiler");
    await expect(preview).not.toContainText('Sign in to compile');
  });

  test('on a phone the toolbar still says the demo is not saved', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);
    await expect(page.locator('.toolbar .note').first()).toHaveText('demo');
    await expect(page.locator('.toolbar .note').last()).toHaveText('not saved');
  });
});

// On a touch phone the section tools are real targets, the editor's menu isn't a
// second ☰, and a sheet's close box is big enough to hit.
test.describe('Editor on a touch phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('touch targets are at least 44px, and the toolbar carries the commands', async ({
    page,
  }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);
    const grip = page.locator('.grip').first();
    const box = (await grip.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    // The toolbar is the one command surface on a phone too; it scrolls sideways.
    const tags = page.getByRole('button', { name: 'Tags' });
    await tags.scrollIntoViewIfNeeded();
    await tags.click();
    const close = page.locator('.drawer .close');
    const c = (await close.boundingBox())!;
    expect(c.width).toBeGreaterThanOrEqual(24);
  });
});
