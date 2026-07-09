import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { gotoEditor, EDITOR_APP } from './helpers';

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

/** Open a menubar pull-down by title. */
async function openMenu(page: Page, title: string) {
  await page.locator('.menus .menu', { hasText: title }).click();
  await expect(page.locator(`.drop[aria-label="${title}"]`)).toBeVisible();
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
    // Demo is the default, and it says so plainly — no red "failed" dot.
    await expect(page.locator('.conn')).toContainText('Demo — nothing saved');
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

  test('the symbols palette inserts a glyph; an unknown command warns', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);

    await page.locator('.entry').first().click();
    const edit = page.locator('.doc .edit');
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
    await edit.locator('.sym-toggle').click();
    await expect(edit.locator('.palette')).toBeVisible();
    await edit.locator('.palette .sym').filter({ hasText: '→' }).first().click();
    await expect(field).toHaveValue('AB→');
  });

  test('the palette + warning also work in the personal-details editor', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);

    await page.locator('.doc-head').click();
    const edit = page.locator('.doc .edit');
    await expect(edit).toBeVisible();
    const field = edit.locator('.grid .fld input').first();

    await field.fill('Ada');
    await field.focus();
    await edit.locator('.sym-toggle').click();
    await expect(edit.locator('.palette')).toBeVisible();
    await edit.locator('.palette .sym').filter({ hasText: 'α' }).first().click();
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
    await letter.locator('.sym-toggle').click();
    await expect(letter.locator('.palette')).toBeVisible();
    await letter.locator('.palette .sym').filter({ hasText: '→' }).first().click();
    await expect(field).toHaveValue('Globex→');

    await field.fill('\\zilch');
    await expect(letter.locator('.warn')).toContainText('\\zilch');
  });

  test('a blocked backend reads as an invitation, not a failure', async ({ page }) => {
    // Simulate Cloudflare Access blocking the unauthenticated data probe — the
    // state EVERY visitor lands in, since the backend is owner-only.
    await page.route('**/api/persons', (route) => route.fulfill({ status: 403 }));
    await gotoEditor(page);

    const invite = page.locator('.invite');
    await expect(invite).toBeVisible();
    await expect(invite).toContainText('Nothing is saved');
    await expect(page.locator('.conn')).toContainText('Demo — nothing saved');
    // Sign-in survives as a quiet link for the owner (still the Access popup,
    // never a hand-built URL) — not an inverted-ink alarm bar.
    await expect(invite.getByRole('button', { name: /Sign in with Google/i })).toBeVisible();
  });

  test('the invitation dismisses to the ◇ chip; File ▸ Reset demo restores the sample', async ({
    page,
  }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);

    const invite = page.locator('.invite');
    await expect(invite).toBeVisible();

    // Edit the demo — the whole point of inviting people to touch it.
    await page.locator('.entry').first().click();
    const inline = page.locator('.doc .edit');
    await expect(inline).toBeVisible();
    await inline.locator('.fld').first().locator('input').fill('Chief Tinkerer');
    await inline.locator('button', { hasText: 'Done' }).click();
    await expect(page.locator('.doc')).toContainText('Chief Tinkerer');

    // Reset lives in File, where a System-6 user looks for Revert. It restores a
    // pristine clone (the store proxies/mutates whatever object it's handed).
    await openMenu(page, 'File');
    await page.getByRole('menuitem', { name: /Reset demo/ }).click();
    await expect(page.locator('.doc')).not.toContainText('Chief Tinkerer');
    await expect(page.locator('.doc')).toContainText('Senior Software Engineer');

    // Dismiss collapses the strip to the chip, which reopens it.
    await invite.getByRole('button', { name: 'Dismiss' }).click();
    await expect(invite).toHaveCount(0);
    await page.locator('.conn').click();
    await expect(page.locator('.invite')).toBeVisible();
  });

  test('the File menu opens, closes, and drives from the keyboard', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);

    const file = page.locator('.menus .menu', { hasText: 'File' });
    const drop = page.locator('.drop[aria-label="File"]');

    // Every menu carries real commands now, so none of them is disabled.
    await expect(page.locator('.menus .menu', { hasText: 'Edit' })).toBeEnabled();
    await expect(page.locator('.menus .menu', { hasText: 'View' })).toBeEnabled();

    // ArrowDown opens and lands focus on the first item.
    await file.focus();
    await page.keyboard.press('ArrowDown');
    await expect(drop).toBeVisible();
    await expect(file).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('menuitem', { name: /Export as JSON/ })).toBeFocused();

    // Roving focus wraps; Escape closes and returns focus to the title.
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: /Reset demo/ })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: /Export as JSON/ })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(drop).toHaveCount(0);
    await expect(file).toBeFocused();

    // A press outside dismisses it, the way a real pull-down does.
    await file.click();
    await expect(drop).toBeVisible();
    await page.locator('.statusbar').click();
    await expect(drop).toHaveCount(0);
  });

  test('Edit ▸ Undo restores a typed burst, and Redo puts it back', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);

    // Nothing done yet → both commands are honestly disabled.
    await openMenu(page, 'Edit');
    await expect(page.getByRole('menuitem', { name: /Undo/ })).toBeDisabled();
    await expect(page.getByRole('menuitem', { name: /Redo/ })).toBeDisabled();
    await page.keyboard.press('Escape');

    await page.locator('.entry').first().click();
    const field = page.locator('.doc .edit .fld input').first();
    await field.fill('Chief Tinkerer');
    await page.locator('.doc .edit button', { hasText: 'Done' }).click();
    await expect(page.locator('.doc')).toContainText('Chief Tinkerer');

    // The label names what will be undone, and typing collapsed into ONE command.
    await openMenu(page, 'Edit');
    await expect(page.getByRole('menuitem', { name: '↶ Undo Position' })).toBeEnabled();
    await page.getByRole('menuitem', { name: '↶ Undo Position' }).click();
    await expect(page.locator('.doc')).not.toContainText('Chief Tinkerer');
    await expect(page.locator('.doc')).toContainText('Senior Software Engineer');

    // One command, not fourteen keystrokes: the stack is now empty.
    await openMenu(page, 'Edit');
    await expect(page.getByRole('menuitem', { name: /Undo/ })).toBeDisabled();
    await page.getByRole('menuitem', { name: '↷ Redo Position' }).click();
    await expect(page.locator('.doc')).toContainText('Chief Tinkerer');
  });

  test('undo restores a deleted section with its bullets and tags', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);
    page.on('dialog', (d) => d.accept());

    const sections = page.locator('.doc .sec h2');
    await expect(sections).toHaveText(['Summary', 'Experience', 'Skills', 'Education']);

    const experience = page
      .locator('.doc .sec')
      .filter({ has: page.locator('h2', { hasText: 'Experience' }) });
    await experience.locator('.tool.danger').click();
    await expect(sections).toHaveText(['Summary', 'Skills', 'Education']);

    // ⌘Z outside a text field drives the document-level undo.
    await page.locator('.statusbar').click();
    await page.keyboard.press('ControlOrMeta+z');

    // Back at its original index, with everything that was inside it.
    await expect(sections).toHaveText(['Summary', 'Experience', 'Skills', 'Education']);
    await expect(page.locator('.doc')).toContainText('Acme Technologies');
    await expect(page.locator('.doc')).toContainText('Mentored four engineers');
    await expect(page.locator('.doc .entry li')).toHaveCount(3);
    await expect(page.locator('.doc .entry li .tag')).toHaveCount(5);
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
    await gotoEditor(page);
    await expect(page.locator('.doc-head h1')).toContainText('Ada Lovelace');

    page.on('dialog', (d) => d.accept());
    await page.locator('.entry').first().click();
    await page.locator('.doc .edit button', { hasText: 'Delete' }).click();
    await expect(page.locator('.doc .entry')).toHaveCount(0);

    await page.locator('.statusbar').click();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.locator('.doc .entry')).toHaveCount(1);
    await expect(page.locator('.doc')).toContainText('Analyst');

    // DELETE, then a real POST to re-create it — and the order PATCH carries the
    // NEW server id (99), not the dead one (11).
    await expect
      .poll(() => calls)
      .toEqual(['DELETE /entries/11', 'POST /sections/2/entries', 'PATCH order [99]']);
  });

  test('undo reverts a variant rule, and the lens re-dims live', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);

    const drawer = page.locator('.drawer');
    await page.locator('.toolbar .variant-btn').click();
    await drawer.locator('.opt').filter({ hasText: 'Backend Engineer' }).click();

    // Exclude #apis → the one bullet carrying it drops out of the lens.
    const apisBullet = page.locator('.doc li').filter({ hasText: 'REST API serving 10,000' });
    await expect(apisBullet).not.toHaveClass(/dim/);
    const excludeIn = drawer.locator('.rule').filter({ hasText: 'Exclude' }).locator('.tag-in');
    await excludeIn.fill('apis');
    await excludeIn.press('Enter');
    await expect(apisBullet).toHaveClass(/dim/);

    // The Edit menu names the exact rule; undoing it lifts the veto and re-dims live.
    await page.keyboard.press('Escape'); // close the drawer so ⌘Z isn't inside the chip input
    await openMenu(page, 'Edit');
    await expect(page.getByRole('menuitem', { name: '↶ Undo Exclude #apis' })).toBeEnabled();
    await page.getByRole('menuitem', { name: '↶ Undo Exclude #apis' }).click();
    await expect(apisBullet).not.toHaveClass(/dim/);
  });

  test('undo reverts a style change, and re-themes the document live', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);

    await page.locator('.toolbar .btn', { hasText: 'Style' }).click();
    const drawer = page.locator('.drawer');
    await expect(drawer.locator('.swatch')).toHaveCount(9);

    const originally = await drawer.locator('.swatch.on').getAttribute('aria-label');
    const target = drawer.locator('.swatch:not(.on)').first();
    const targetLabel = await target.getAttribute('aria-label');
    await target.click();
    await expect(drawer.locator('.swatch.on')).toHaveAttribute('aria-label', targetLabel!);

    await page.keyboard.press('Escape');
    await openMenu(page, 'Edit');
    await expect(page.getByRole('menuitem', { name: '↶ Undo Accent color' })).toBeEnabled();
    await page.getByRole('menuitem', { name: '↶ Undo Accent color' }).click();

    // Reopen Style: the original swatch is selected again.
    await page.locator('.toolbar .btn', { hasText: 'Style' }).click();
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
    await drawer.locator('.opt').filter({ hasText: 'Backend Engineer' }).click();
    const excludeIn = drawer.locator('.rule').filter({ hasText: 'Exclude' }).locator('.tag-in');
    await excludeIn.fill('apis');
    await excludeIn.press('Enter');

    // History has the rule command…
    await page.keyboard.press('Escape');
    await openMenu(page, 'Edit');
    await expect(page.getByRole('menuitem', { name: /Undo Exclude/ })).toBeEnabled();
    await page.keyboard.press('Escape');

    // …deleting the variant clears it.
    await page.locator('.toolbar .variant-btn').click();
    await drawer.locator('.del').click();
    await page.keyboard.press('Escape');
    await openMenu(page, 'Edit');
    await expect(page.getByRole('menuitem', { name: /Undo/ })).toBeDisabled();
  });

  test('undo history survives a profile switch and back', async ({ page }) => {
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
    await gotoEditor(page);

    // fetchActive defaults to the highest id → Ada (8). Edit her position field.
    await expect(page.locator('.doc-head h1')).toContainText('Ada Lovelace');
    await page.locator('.entry').first().click();
    await page.locator('.doc .edit .fld input').first().fill('Chief Analyst');
    await page.locator('.doc .edit button', { hasText: 'Done' }).click();
    await expect(page.locator('.doc')).toContainText('Chief Analyst');

    // Switch to Grace: a different profile, her own (empty) history.
    await page.locator('.toolbar .profile-btn').click();
    await page.locator('.drawer .opt').filter({ hasText: 'Grace Hopper' }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.doc')).toContainText('Admiral');
    await openMenu(page, 'Edit');
    await expect(page.getByRole('menuitem', { name: /Undo/ })).toBeDisabled();
    await page.keyboard.press('Escape');

    // Back to Ada — from cache (adaGets stays 1) — with her edit AND her undo intact.
    await page.locator('.toolbar .profile-btn').click();
    await page.locator('.drawer .opt').filter({ hasText: 'Ada Lovelace' }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.doc-head h1')).toContainText('Ada Lovelace');
    expect(adaGets).toBe(1); // cache hit — no refetch
    await expect(page.locator('.doc')).toContainText('Chief Analyst');

    await openMenu(page, 'Edit');
    await expect(page.getByRole('menuitem', { name: '↶ Undo Position' })).toBeEnabled();
    await page.getByRole('menuitem', { name: '↶ Undo Position' }).click();
    await expect(page.locator('.doc')).toContainText('Analyst');
    await expect(page.locator('.doc')).not.toContainText('Chief Analyst');
  });

  test('the View menu toggles the preview pane and opens the panels', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);

    // The pane is a toggle, so it is a menuitemcheckbox — a ✓ faked into the label
    // would leave a screen reader with no idea the thing has a state.
    await openMenu(page, 'View');
    const previewItem = page.getByRole('menuitemcheckbox', { name: '◱ Preview' });
    await expect(previewItem).toHaveAttribute('aria-checked', 'false');
    await previewItem.click();
    await expect(page.locator('.preview')).toBeVisible();

    // Reopen: the checkmark tracks the pane, so the menu can be read at a glance.
    await openMenu(page, 'View');
    await expect(page.getByRole('menuitemcheckbox', { name: '◱ Preview' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByRole('menuitemcheckbox', { name: '◱ Preview' }).click();
    await expect(page.locator('.preview')).toHaveCount(0);

    // …and the panels open from here too, mirroring the toolbar.
    await openMenu(page, 'View');
    await page.getByRole('menuitem', { name: 'Tags…' }).click();
    await expect(page.locator('.drawer[aria-label="Tags"]')).toBeVisible();
  });

  test('File ▸ Reset demo is disabled for a signed-in profile', async ({ page }) => {
    // resetDemo() is a no-op when connected — there is real data to protect. Say so
    // in the menu instead of offering a command that silently does nothing.
    await mockAdaWithVariant(page);
    await gotoEditor(page);
    await expect(page.locator('.doc-head h1')).toContainText('Ada Lovelace');

    await openMenu(page, 'File');
    await expect(page.getByRole('menuitem', { name: /Reset demo/ })).toBeDisabled();
    await expect(page.getByRole('menuitem', { name: /Export as JSON/ })).toBeEnabled();
  });

  test('the guided tour drives the real editor, then yields at the first touch', async ({
    page,
  }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);

    const tour = page.locator('.tour');
    await page.locator('.tour-start').click();
    await expect(tour).toBeVisible();
    await expect(tour.locator('.count')).toHaveText('1 of 7');
    // Step 1 drives the REAL editor — the same inline editor a click opens.
    await expect(page.locator('.doc .edit')).toBeVisible();

    // Step 2 types a genuinely new bullet into the document, character by character.
    await expect(tour.locator('.count')).toHaveText('2 of 7');
    const typed = page.locator('.doc .edit .bl-content').last();
    await expect(typed).toHaveValue(/^Cut p/);
    const bullets = await page.locator('.doc .edit .bl').count();

    // The signature interaction: one touch outside the tour hands back the wheel.
    await page.locator('.statusbar').click();
    await expect(tour.locator('.wheel')).toHaveText('Paused — you have the wheel.');
    await expect(tour.getByRole('button', { name: /Resume/ })).toBeVisible();

    // It stops mid-word and stays stopped — a paused tour never auto-resumes.
    const frozen = await typed.inputValue();
    await page.waitForTimeout(1200); // > nothing: proves no dwell timer survived
    expect(await typed.inputValue()).toBe(frozen);
    await expect(tour.locator('.count')).toHaveText('2 of 7');

    // Resume re-enters the step, so narration matches the screen — and because
    // `enter` is idempotent it restages the same bullet rather than adding another.
    await tour.getByRole('button', { name: /Resume/ }).click();
    await expect(tour.locator('.wheel')).toHaveCount(0);
    await expect(typed).toHaveValue(/queries\.$/, { timeout: 5000 });
    expect(await page.locator('.doc .edit .bl').count()).toBe(bullets);

    // Esc ends it outright (the drawer convention).
    await page.keyboard.press('Escape');
    await expect(tour).toHaveCount(0);
  });

  test('reduced motion degrades the tour to a manual step-through', async ({ page }) => {
    // The tour moves the page — a vestibular hazard, so auto-advance must not happen.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);

    const tour = page.locator('.tour');
    await page.locator('.tour-start').click();
    await expect(tour.locator('.count')).toHaveText('1 of 7');
    await expect(tour.getByRole('button', { name: /Next/ })).toBeVisible();
    await expect(tour.getByRole('button', { name: /Pause/ })).toHaveCount(0);

    // Sit on step 1: nothing advances on its own.
    await page.waitForTimeout(1500);
    await expect(tour.locator('.count')).toHaveText('1 of 7');

    await tour.getByRole('button', { name: /Next/ }).click();
    await expect(tour.locator('.count')).toHaveText('2 of 7');
    // …and the typewriter becomes an instant state change.
    await expect(page.locator('.doc .edit .bl-content').last()).toHaveValue(/queries\.$/);
  });

  test('ending the tour puts away the drawer it opened', async ({ page }) => {
    // Step 5 opens the variant drawer. A modal scrim the visitor never asked for
    // must not outlive the tour that raised it. (Reduced motion → deterministic:
    // step through with Next rather than waiting on dwell timers.)
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page);

    const tour = page.locator('.tour');
    await page.locator('.tour-start').click();
    const next = tour.getByRole('button', { name: /Next/ });
    for (let i = 0; i < 4; i += 1) await next.click();
    await expect(tour.locator('.count')).toHaveText('5 of 7');
    await expect(page.locator('.drawer')).toBeVisible();

    await tour.getByRole('button', { name: '✕ End', exact: true }).click();
    await expect(tour).toHaveCount(0);
    await expect(page.locator('.drawer')).toHaveCount(0);
    await expect(page.locator('.scrim')).toHaveCount(0);
  });

  test('a forwarded ?tour=1 link opens straight into the narrative', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await gotoEditor(page, `${EDITOR_APP}?tour=1`);
    await expect(page.locator('.tour')).toBeVisible();
    await expect(page.locator('.tour .count')).toHaveText('1 of 7');
  });

  test('the tour never runs against a signed-in profile', async ({ page }) => {
    // The tour *writes* (it adds a bullet). Against a live backend that would edit
    // a real CV, so canRun() gates it on demo mode — even via the deep link.
    await mockAdaWithVariant(page);
    await gotoEditor(page, `${EDITOR_APP}?tour=1`);

    await expect(page.locator('.doc-head h1')).toContainText('Ada Lovelace');
    await expect(page.locator('.tour')).toHaveCount(0);
    await expect(page.locator('.tour-start')).toHaveCount(0); // no entry point either
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
    await expect(page.locator('.invite')).toHaveCount(0); // connected → no demo strip

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
      // legacy person-level header — the new frontend reads the variant's, not this
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

    await gotoEditor(page);
    await expect(page.locator('.conn')).toContainText('connected');

    await selectVariant(page, 'Cover Letter');
    const letter = page.locator('.letter');
    await expect(letter.locator('.para .body')).toHaveValue('Existing paragraph.');
    // the header comes from the VARIANT (GET /variants/60), not the person
    await expect(letter.locator('.fields .in').first()).toHaveValue('Globex');

    // Edit the recipient → debounced PATCH /variants/60/header, LaTeX-escaped.
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
