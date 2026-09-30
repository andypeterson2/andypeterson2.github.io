import { test, expect } from '@playwright/test';

const APP = '/projects/quantum-nonogram-solver/app/';

type Page = import('@playwright/test').Page;

/**
 * The metrics row whose label is exactly `name`.
 *
 * Playwright's `hasText` is a substring match, which would make 'Per extra cell' select
 * 'Per extra cell, measured' too, so the label is matched whole.
 */
/** Type a board size into the corner the two runs of clues share. */
const setSize = async (page: Page, rows: number, cols: number) => {
  await page.locator('#size-rows').fill(String(rows));
  await page.locator('#size-rows').press('Enter');
  await page.locator('#size-cols').fill(String(cols));
  await page.locator('#size-cols').press('Enter');
  await expect(page.locator('td.cell')).toHaveCount(rows * cols);
};

const metricRow = (page: Page, name: string) =>
  page.locator('#metrics-pane tbody tr').filter({ has: page.getByText(name, { exact: true }) });

test.describe('Nonogram: results always describe the puzzle on screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.goto(APP);
    await expect(page.locator('td.cell').first()).toBeVisible();
  });

  // Editing a loaded gallery run clears its solutions, histogram, gallery label and
  // "a real run on the Grover simulator", which describe a different grid.
  test('editing after a gallery run clears the run', async ({ page }) => {
    await page.locator('#gallery-select').selectOption({ index: 1 });
    await expect(page.locator('#qu-list .sol-table').first()).toBeVisible();

    await page.locator('td.cell').first().dispatchEvent('mousedown');
    await expect(page.locator('#gallery-select')).toHaveValue('');
    await expect(page.locator('#qu-sol-placeholder')).toContainText('Solve the puzzle');
  });

  test('the grid shrinks; Clear keeps the size and Reset returns it', async ({ page }) => {
    const rows = page.locator('#size-rows');
    const cols = page.locator('#size-cols');
    await setSize(page, 4, 4);
    await expect(rows).toHaveValue('4');
    await expect(cols).toHaveValue('4');
    await setSize(page, 3, 4);

    // The board a reader sized is theirs; Clear empties it where it stands.
    await page.locator('td.cell').first().dispatchEvent('mousedown');
    await page.locator('#btn-clear').click();
    await expect(rows).toHaveValue('3');
    await expect(cols).toHaveValue('4');
    await expect(page.locator('td.cell.filled')).toHaveCount(0);

    await page.locator('#btn-reset').click();
    await expect(rows).toHaveValue('3');
    await expect(cols).toHaveValue('3');
  });

  test('a grid past the browser limit says what to do', async ({ page }) => {
    await setSize(page, 6, 6);
    await page.locator('#btn-bench').click();
    await expect(page.locator('#status-line')).toContainText('remove a row or column');
  });
});

// Clues mode: the clues are the puzzle, typed rather than read off a drawing, so a
// clue set with no solution is something the editor can express and the solver answers.
test.describe('Nonogram: typing the clues', () => {
  const clue = (kind: 'row' | 'col', index: number, slot: number) =>
    `input[data-clue-kind="${kind}"][data-clue-index="${String(index)}"]` +
    `[data-clue-slot="${String(slot)}"]`;

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.goto(APP);
    await expect(page.locator('td.cell').first()).toBeVisible();
    // The page opens on a captured run; these tests are about an empty board.
    await page.locator('#btn-clear').click();
    await page.locator('#btn-mode-clues').click();
  });

  test('the cells become the unknown and the clues become inputs', async ({ page }) => {
    await expect(page.locator('td.cell')).toHaveCount(0);
    await expect(page.locator('td.cell-unknown')).toHaveCount(9);
    await expect(page.locator('.clue-slot--input')).toHaveCount(6);
    await expect(page.locator('#btn-mode-clues')).toHaveAttribute('aria-pressed', 'true');
  });

  test('a clue set with no solution is reported as such', async ({ page }) => {
    // Every row full but every column holding one cell: the counts cannot agree.
    for (let r = 0; r < 3; r++) await page.locator(clue('row', r, 0)).fill('3');
    for (let c = 0; c < 3; c++) await page.locator(clue('col', c, 0)).fill('1');
    await page.locator('#btn-bench').click();
    await expect(page.locator('#cl-placeholder')).toContainText('No solutions found');
  });

  test('typing a run opens the next slot, and a solvable set solves', async ({ page }) => {
    // One slot each until a clue needs two.
    await expect(page.locator(clue('row', 0, 1))).toHaveCount(0);
    for (let r = 0; r < 3; r++) {
      await page.locator(clue('row', r, 0)).fill('1');
      await page.locator(clue('row', r, 1)).fill('1');
    }
    await page.locator(clue('col', 0, 0)).fill('3');
    await page.locator(clue('col', 2, 0)).fill('3');
    await page.locator('#btn-bench').click();
    // Counted in the metrics table; the sections carry their own timings.
    await expect(metricRow(page, 'Solutions').locator('td').first()).toHaveText('1');
    await expect(page.locator('#cl-canvas .sol-grid-label')).toHaveText('Solution');
  });

  test('going back to Draw hands the clues to the grid again', async ({ page }) => {
    await page.locator(clue('row', 0, 0)).fill('3');
    await page.locator('#btn-mode-draw').click();
    await expect(page.locator('.clue-slot--input')).toHaveCount(0);
    await expect(page.locator('td.cell')).toHaveCount(9);
  });
});

// The browser tier runs Grover's amplitudes as well as the classical search, so the
// Quantum panel answers without a backend — and says only what a simulation can.
test.describe('Nonogram: the quantum half runs in the browser', () => {
  const grover = (page: Page, name: string) => metricRow(page, name).locator('td').last();
  const exhaustive = (page: Page, name: string) => metricRow(page, name).locator('td').first();
  const backtracking = (page: Page, name: string) => metricRow(page, name).locator('td').nth(1);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.goto(APP);
    await expect(page.locator('td.cell').first()).toBeVisible();
  });

  test('a solved puzzle fills the histogram and the Grover metrics', async ({ page }) => {
    for (const i of [0, 1, 2, 3]) await page.locator('.cell-btn').nth(i).click();
    await page.locator('#btn-bench').click();

    // Each figure annotates the section it measures rather than piling into one line.
    await expect(page.locator('#cl-meta')).toHaveText(/ms$/);
    // The rules carry a figure each; the quantum one is how long the draw took.
    await expect(page.locator('#qu-meta')).toHaveText(/ms$/);
    // The chart marks the grids the clues accept rather than the ones a line clears:
    // solid bars are solutions, and this board has exactly one.
    await expect(page.locator('#qu-histogram .hist-bar:not(.hist-below)')).toHaveCount(1);
    await expect(page.locator('#qu-list .sol-table')).toHaveCount(1);
    // Nothing restated underneath.
    await expect(page.locator('#status-line')).toBeHidden();

    await expect(page.locator('#qu-histogram rect.hist-bar').first()).toBeVisible();
    await expect(grover(page, 'Qubits')).toHaveText('9');
    await expect(grover(page, 'P(solution), ideal')).toContainText('%');

    // Three methods, and the puzzle is not unstructured search: the page's own solver
    // asks the clues fewer questions than Grover does.
    const checks = async (fn: (p: Page, n: string) => ReturnType<typeof grover>) =>
      Number((await fn(page, 'Clue checks').textContent())?.replace(/,/g, ''));
    expect(await checks(exhaustive)).toBe(512);
    expect(await checks(backtracking)).toBeLessThan(await checks(grover));

    // The scaling, stated as arithmetic, against what the built circuit actually does.
    // A letter x: the body face has no multiplication sign of its own.
    await expect(exhaustive(page, 'Per extra cell')).toHaveText('2x');
    await expect(grover(page, 'Per extra cell')).toHaveText('1.41x');
    await expect(grover(page, 'Per extra cell, measured')).toHaveText('2.17x');

    // Measured, and hopeless: the circuit asks for far more than the device holds.
    await expect(grover(page, 'Depth (layers)')).not.toHaveText('—');
    await expect(grover(page, 'Device budget (layers)')).toContainText('over');
    await expect(grover(page, 'Rounds that fit')).toContainText('of');
  });

  test('the chart brackets the bars the clues accept and counts them', async ({ page }) => {
    await page.locator('#gallery-select').selectOption({ index: 1 });
    await expect(page.locator('#qu-histogram .hist-bracket')).toHaveCount(1);
    await expect(page.locator('#qu-histogram .hist-count')).toHaveText(/^\d+ solutions?$/);
  });

  test('the scale holds its place while the bars scroll past it', async ({ page }) => {
    // The stored 3x3 run measured hundreds of outcomes, so the chart runs wider than
    // its frame. The figures are drawn beside the frame rather than inside it.
    await page.locator('#gallery-select').selectOption({ index: 3 });
    await expect(page.locator('#qu-histogram .hist-bar').first()).toBeVisible();

    const room = await page
      .locator('#qu-scroll')
      .evaluate((el) => [el.scrollWidth, el.clientWidth]);
    expect(room[0]).toBeGreaterThan(room[1]);

    // Pinned: the figures sit where they sat once the bars have run past them.
    const axis = page.locator('#qu-axis');
    await expect(axis.locator('.hist-text').first()).toBeVisible();
    const before = await axis.boundingBox();
    await page.locator('#qu-scroll').evaluate((el) => {
      el.scrollLeft = 900;
    });
    const after = await axis.boundingBox();
    expect(after?.x).toBeCloseTo(before?.x ?? -1, 0);

    // The rule over it names the run and carries the sampling as hover text.
    await expect(page.locator('#hist-meta')).toHaveText(/shots/);
    await expect(page.locator('#hist-meta')).toHaveAttribute('title', /shots/);
  });

  test('the quantum solution matches the classical one', async ({ page }) => {
    // An asymmetric grid: a mirrored reading would show a different picture.
    for (const i of [0, 1, 2, 3]) await page.locator('.cell-btn').nth(i).click();
    await page.locator('#btn-bench').click();
    await expect(page.locator('#qu-list .sol-table')).toHaveCount(1);

    const cells = (root: string) =>
      page
        .locator(`${root} .sol-table td`)
        .evaluateAll((tds) => tds.map((td) => td.className).join(''));
    expect(await cells('#qu-list')).toBe(await cells('#cl-canvas'));
  });

  test('clues with no solution amplify nothing, and say so', async ({ page }) => {
    await page.locator('#btn-mode-clues').click();
    for (let r = 0; r < 3; r++) {
      await page
        .locator(`input[data-clue-kind="row"][data-clue-index="${String(r)}"]`)
        .first()
        .fill('3');
    }
    for (let c = 0; c < 3; c++) {
      await page
        .locator(`input[data-clue-kind="col"][data-clue-index="${String(c)}"]`)
        .first()
        .fill('1');
    }
    await page.locator('#btn-bench').click();
    await expect(page.locator('#cl-placeholder')).toContainText('No solutions found');
    // A sampled draw would put a few states over the line by luck; a flat
    // distribution puts none, which is what no solution means.
    await expect(page.locator('#qu-sol-placeholder')).toContainText(
      'No solution among the measured grids',
    );
    await expect(grover(page, 'Clue checks')).toHaveText('0');
  });
});

test.describe('Nonogram: the circuit is copyable for any board', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.goto(APP);
    await expect(page.locator('td.cell').first()).toBeVisible();
  });

  test('the code shows without solving, and describes the board on screen', async ({ page }) => {
    // The circuit describes the puzzle itself, so it is there before any run.
    await expect(page.locator('#code-pane')).toBeVisible();
    await expect(page.locator('#circuit-svg .circ-label')).toHaveCount(9);
    await expect(page.locator('#code-listing')).toContainText('def oracle(qc):');
  });

  test('the circuit is drawn above the listing', async ({ page }) => {
    const svg = page.locator('#circuit-svg');
    await expect(svg).toBeVisible();
    await expect(svg.locator('.circ-wire')).toHaveCount(9);
    await expect(svg.locator('.circ-box-name').first()).toHaveText('Oracle');
    await expect(svg.locator('.circ-repeat')).toContainText('\u00d7');
  });

  test('the listing is circuit and nothing else', async ({ page }) => {
    const text = (await page.locator('#code-listing').textContent()) ?? '';
    for (const line of text.split('\n')) {
      expect(line.trimStart().startsWith('#')).toBe(false);
    }
    // What it means sits beside the listing instead, where it is readable.
    await expect(page.locator('#code-listing')).toHaveAttribute('title', /little-endian/);
  });

  test('editing the grid rewrites the code', async ({ page }) => {
    const before = await page.locator('#code-listing').textContent();
    await page.locator('td.cell').first().dispatchEvent('mousedown');
    await expect(page.locator('#code-listing')).not.toHaveText(before ?? '');
  });

  test('the listing never reaches for the oracle that enumerates every assignment', async ({
    page,
  }) => {
    // PhaseOracleGate walks all 2^n assignments, so a pasted script would stall.
    await expect(page.locator('#code-listing')).not.toContainText('PhaseOracleGate');
    await expect(page.locator('#code-listing')).toContainText('for _ in range(ITERATIONS)');
  });

  test('the view switch swaps the pane and shows which is active', async ({ page }) => {
    const qasm = page.locator('#btn-fmt-qasm');
    const qiskit = page.locator('#btn-fmt-qiskit');
    const circuit = page.locator('#btn-view-circuit');
    // The drawing is what the pane opens on; the listing waits behind it.
    await expect(circuit).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#circuit-figure')).toBeVisible();
    await expect(page.locator('.code-box')).toBeHidden();

    await qiskit.click();
    await expect(page.locator('.code-box')).toBeVisible();
    await expect(page.locator('#circuit-figure')).toBeHidden();

    await qasm.click();
    await expect(qasm).toHaveAttribute('aria-pressed', 'true');
    await expect(qiskit).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#code-listing')).toContainText('OPENQASM 3.0;');
    await expect(page.locator('#code-listing')).toContainText('gate diffuser');

    await qiskit.click();
    await expect(page.locator('#code-listing')).toContainText('from qiskit import');

    await circuit.click();
    await expect(page.locator('#circuit-figure')).toBeVisible();
    await expect(page.locator('.code-box')).toBeHidden();
  });

  test('Copy puts the listing on the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('#btn-fmt-qiskit').click();
    await page.locator('#btn-copy-code').click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('def oracle(qc):');
  });

  test('a board too big to solve still produces code', async ({ page }) => {
    // Past the local solve limit the constraint oracle takes over, which is the
    // whole reason a large board can still be exported.
    await setSize(page, 6, 6);
    // Every qubit gets a wire, however many the board asks for.
    await expect(page.locator('#circuit-svg .circ-label')).toHaveCount(48);
    await expect(page.locator('#code-listing')).toHaveAttribute(
      'title',
      /past what the page solves/,
    );
    // One wire per qubit: 36 cells and the ancillas the constraint oracle needs.
    await expect(page.locator('#circuit-svg .circ-wire')).toHaveCount(48);
  });
});

test.describe('Nonogram: the metrics table compares three methods', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.goto(APP);
    await expect(page.locator('td.cell').first()).toBeVisible();
    for (const i of [0, 1, 2, 3]) await page.locator('.cell-btn').nth(i).click();
    await page.locator('#btn-bench').click();
    // The frame is on the page from the start, so wait for the figures rather than the
    // table: until they land, a repaint can pull an element out from under an assertion.
    await expect(page.locator('.metrics-table tbody td:not(.na)').first()).not.toBeEmpty();
  });

  test('names all three methods, in two sections named down the side', async ({ page }) => {
    const heads = page.locator('.metrics-table thead th');
    await expect(heads).toHaveText(['Metric', 'Exhaustive', 'Backtracking', 'Grover']);
    const spines = page.locator('.metrics-table th.spine');
    await expect(spines).toHaveText(['Search', 'If it ran on a device']);
    // Each spine covers every row of its own section.
    await expect(spines.first()).toHaveAttribute('rowspan', '5');
    // The qualifiers the rotated names could not carry are their hover text. The
    // measured column's oracle already holds the answer, so its cost is a floor.
    await expect(spines.first()).toHaveAttribute('title', /9 cells/);
    await expect(spines.last()).toHaveAttribute('title', /lower bound/);
  });

  test('bold belongs to the headers, not the body', async ({ page }) => {
    const weight = (l: ReturnType<typeof page.locator>) =>
      l.first().evaluate((el) => getComputedStyle(el).fontWeight);
    expect(Number(await weight(page.locator('.metrics-table thead th')))).toBeGreaterThan(500);
    expect(Number(await weight(page.locator('.metrics-table th[scope="row"]')))).toBeLessThan(500);
  });

  test('the classical side of the device group is marked inapplicable, not missing', async ({
    page,
  }) => {
    const na = page.locator('.metrics-table .na');
    await expect(na.first()).toHaveAttribute('colspan', '2');
    await expect(na.first().locator('.sr-only')).toHaveText('not applicable');
  });

  test('the device group costs the circuit the way an attack estimate is costed', async ({
    page,
  }) => {
    // Width times depth, and what it comes to against one classical processor.
    await expect(metricRow(page, 'Spacetime (qubit-layers)').locator('td').last()).toHaveText(
      /[0-9,]+/,
    );
    await expect(page.locator('.metrics-note td')).toContainText('qubit-layers against');
    await expect(page.locator('.metrics-note td')).toContainText('gate-steps');
  });

  test('every label says what it means as hover text', async ({ page }) => {
    // Every row in the table is a figure, so nothing in it is pressable.
    await expect(page.locator('.metrics-table button')).toHaveCount(0);

    const titles = await page
      .locator('.metrics-table th')
      .evaluateAll((els) =>
        els
          .filter((el) => !el.classList.contains('spine-corner'))
          .map((el) => el.getAttribute('title') ?? ''),
      );
    expect(titles.length).toBeGreaterThan(14);
    expect(titles.filter((t) => t.length < 40)).toEqual([]);

    // The two section names carry what the rotated text has no room for.
    const spines = page.locator('.metrics-table th.spine');
    await expect(spines.nth(1)).toHaveAttribute('title', /lower bound/);
  });

  test('every method survives a narrow screen, on its own line', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    // Three figures abreast under a full-width label.
    const row = page.locator('.metrics-table tr.metric').first();
    await expect(row).toHaveCSS('display', 'grid');
    const label = row.locator('th[scope="row"]');
    await expect(label).toHaveCSS('grid-column-start', '1');
    await expect(page.locator('.metrics-table thead th').first()).toBeHidden();
    // Still three methods: nothing was dropped to make it fit.
    await expect(page.locator('.metrics-table thead th')).toHaveCount(4);

    const overflow = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      return [...document.querySelectorAll('#metrics-pane *')].filter(
        (e) => e.getBoundingClientRect().right > vw + 1,
      ).length;
    });
    expect(overflow).toBe(0);
  });
});

test.describe('Nonogram: the circuit band follows the width', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
  });

  test('the circuit is on the page at every width, with nothing to unfold', async ({ page }) => {
    for (const width of [1280, 375]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(APP);
      await expect(page.locator('#circuit-figure')).toBeVisible();
      await expect(page.locator('#circuit-band summary')).toHaveCount(0);
    }
  });
});

test.describe('Nonogram: the circuit opens up', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(APP);
    await expect(page.locator('#circuit-svg [data-block]').first()).toBeVisible();
  });

  const box = (page: Page, block: string) => page.locator(`#circuit-svg [data-block="${block}"]`);

  test('the drawing is a group, so the boxes inside it stay reachable', async ({ page }) => {
    // role="img" would make every mark presentational, the two controls included.
    await expect(page.locator('#circuit-svg')).toHaveAttribute('role', 'group');
    await expect(page.locator('#circuit-svg [data-block]')).toHaveCount(2);
  });

  test('pressing a box writes it out in place, and pressing it again folds it', async ({
    page,
  }) => {
    const frame = page.locator('#circuit-svg .circ-frame');
    await expect(frame).toHaveCount(0);

    await box(page, 'oracle').click();
    await expect(frame).toHaveCount(1);
    await expect(box(page, 'oracle')).toHaveAttribute('aria-pressed', 'true');
    // A multi-controlled Z draws as dots joined to its target.
    await expect(page.locator('#circuit-svg .circ-ctrl').first()).toBeVisible();

    await box(page, 'oracle').click();
    await expect(frame).toHaveCount(0);
    await expect(box(page, 'oracle')).toHaveAttribute('aria-pressed', 'false');
  });

  test('the two open independently, and together write out a whole iteration', async ({ page }) => {
    await box(page, 'oracle').click();
    await box(page, 'diffuser').click();
    await expect(page.locator('#circuit-svg .circ-frame')).toHaveCount(2);
    await expect(box(page, 'oracle')).toHaveAttribute('aria-pressed', 'true');
    await expect(box(page, 'diffuser')).toHaveAttribute('aria-pressed', 'true');
  });

  test('the drawing is the only thing that opens a block', async ({ page }) => {
    await expect(page.locator('#btn-block-oracle')).toHaveCount(0);
    await expect(page.locator('#btn-block-diffuser')).toHaveCount(0);

    await box(page, 'diffuser').click();
    await expect(box(page, 'diffuser')).toHaveAttribute('aria-pressed', 'true');
    await expect(box(page, 'oracle')).toHaveAttribute('aria-pressed', 'false');
  });

  test('the drawing takes the room the gates need', async ({ page }) => {
    const width = async () => (await page.locator('#circuit-svg').boundingBox())?.width ?? 0;
    const folded = await width();
    await box(page, 'oracle').click();
    await expect(page.locator('#circuit-svg .circ-frame')).toHaveCount(1);
    expect(await width()).toBeGreaterThan(folded);
    // Wider than its box, so the figure scrolls rather than the page.
    await expect(page.locator('#circuit-figure')).toBeVisible();
  });

  test('a block says what it is made of on hover', async ({ page }) => {
    await expect(box(page, 'oracle').locator('title')).toContainText('built from the answers');
    await expect(box(page, 'diffuser').locator('title')).toContainText('about the average');
  });

  test('a box opens from the keyboard', async ({ page }) => {
    await box(page, 'diffuser').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#circuit-svg .circ-frame')).toHaveCount(1);
    await page.keyboard.press(' ');
    await expect(page.locator('#circuit-svg .circ-frame')).toHaveCount(0);
  });

  test('an open block survives an edit, though the drawing is rebuilt', async ({ page }) => {
    await box(page, 'oracle').click();
    await expect(page.locator('#circuit-svg .circ-frame')).toHaveCount(1);
    await page.locator('.cell-btn').first().click();
    // The drawing is replaced wholesale, so both the state and the listener have to
    // live outside it.
    await expect(page.locator('#circuit-svg .circ-frame')).toHaveCount(1);
    await expect(box(page, 'oracle')).toHaveAttribute('aria-pressed', 'true');
    await box(page, 'oracle').click();
    await expect(page.locator('#circuit-svg .circ-frame')).toHaveCount(0);
  });

  test('a phone gets the same two boxes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(APP);
    await expect(page.locator('#circuit-svg [data-block]').first()).toBeVisible();
    await expect(page.locator('#btn-view-circuit')).toBeVisible();
  });
});
