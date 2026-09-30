/**
 * Solver interaction & result rendering (classical, quantum,
 * histogram).
 */

import {
  state,
  $,
  must,
  elHistSvg,
  elHistAxis,
  elQuPlaceholder,
  elClPlaceholder,
  elQuList,
  elQuSolPlaceholder,
  type HistData,
} from './state';
import { getBestSolSize, getCurrentPuzzle } from './grid';
import { classicalCost, formatCount } from './classical-cost';
import {
  COST_OPTIMIZATION,
  COST_SEEDS,
  COST_TARGET,
  DEPTH_BUDGET,
  hardwareCost,
  measuredGrowth,
  measuredRoundGrowth,
  overBudget,
  type HardwareCost,
} from './hardware-cost';
import { satisfies, solveLocal } from './classical-solver';
import { groverOutcome, optimalIterations } from './grover-sim';

/** A bar narrower than this is not a bar, so the chart widens past its frame instead. */
const MIN_BAR_SLOT = 9;
/** The break between the grids the clues accept and everything else. */
const GAP_AFTER_SOLUTIONS = 34;

// Wire shapes (hand-derived from the nonogram backend's payloads)

export interface ClassicalReport {
  solutions_found?: number;
}

export interface QuantumReport {
  solutions_found?: number;
  num_qubits?: number;
  circuit_depth?: number;
  grover_iterations?: number;
  top_result_probability?: number | null;
}

export interface BenchmarkReport {
  num_variables?: number;
  classical?: ClassicalReport | null;
  quantum?: QuantumReport | null;
}

export interface ClassicalResult {
  solutions: string[] | null | undefined;
  rows: number;
  cols: number;
}

export interface BenchmarkPayload {
  report?: BenchmarkReport | null;
  solutions?: string[];
  qu_counts?: Record<string, number>;
  qu_counts_per_trial?: Record<string, number>[];
  rows: number;
  cols: number;
  cl_times?: number[] | null;
  qu_times?: number[] | null;
}

// Helpers
export function clearSolverResults(): void {
  const clEl = must('cl-canvas');
  Array.from(clEl.children).forEach((c) => {
    if (c.id !== 'cl-placeholder') c.remove();
  });
  elClPlaceholder.style.display = '';
  elClPlaceholder.textContent = 'Running…';

  elQuList.innerHTML = '';
  elQuList.appendChild(elQuSolPlaceholder);
  elQuSolPlaceholder.textContent = 'Running…';

  elHistSvg.innerHTML = '';
  state.histData = null;
  elQuPlaceholder.style.display = 'block';

  // The rules carried the last run's figures; they describe nothing now.
  setRunMeta({});
  clearMetrics();
}

/** A "0"/"1" solution string as a small table of filled/empty cells. */
function solutionTable(bs: string, rows: number, cols: number, sz: string): HTMLTableElement {
  const tbl = document.createElement('table');
  tbl.className = 'sol-table sz-' + sz;
  for (let r = 0; r < rows; r++) {
    const tr = tbl.insertRow();
    for (let c = 0; c < cols; c++) {
      const td = tr.insertCell();
      td.className = bs[r * cols + c] === '1' ? 'f' : 'e';
    }
  }
  return tbl;
}

// Classical result renderer
export function renderClassical({ solutions, rows, cols }: ClassicalResult): void {
  const el = must('cl-canvas');
  Array.from(el.children).forEach((child) => {
    if (child.id !== 'cl-placeholder') child.remove();
  });

  if (!solutions || solutions.length === 0) {
    elClPlaceholder.style.display = '';
    elClPlaceholder.textContent = solutions
      ? 'No solutions found.'
      : 'Run ▶ Solve to see classical solutions.';
    return;
  }

  elClPlaceholder.style.display = 'none';
  const sz = getBestSolSize(rows, cols);

  solutions.forEach((bs, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'sol-grid-wrap';
    const lbl = document.createElement('div');
    lbl.className = 'sol-grid-label';
    lbl.textContent = solutions.length > 1 ? `Solution ${String(idx + 1)}` : 'Solution';
    wrap.appendChild(lbl);
    wrap.appendChild(solutionTable(bs, rows, cols, sz));
    el.appendChild(wrap);
  });
}

// Quantum histogram & solutions
/**
 * A measurement as a grid string.
 *
 * Qiskit reports little-endian bitstrings, so the first cell is the last character.
 */
function asGrid(bits: string): string {
  return bits.split('').reverse().join('');
}

export function renderQuantum(
  counts: Record<string, number> | null | undefined,
  rows: number,
  cols: number,
): void {
  if (!counts || Object.keys(counts).length === 0) {
    drawEmptyHistogram();
    return;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const entries: [string, number][] = Object.entries(counts).map(([bs, cnt]) => [
    bs,
    total > 0 ? cnt / total : 0,
  ]);
  entries.sort((a, b) => b[1] - a[1]);
  const totalOutcomes = entries.length;

  // Which grids are solutions is a fact about the clues, so it is checked here over
  // everything that came back, before the chart drops what it cannot draw.
  const puzzle = getCurrentPuzzle();
  const verified = entries.filter(([bs]) =>
    satisfies(asGrid(bs), puzzle.row_clues, puzzle.col_clues),
  );

  state.histData = { entries, verified, rows, cols, totalOutcomes };
  elQuPlaceholder.style.display = 'none';

  drawHistogram(state.histData);
  renderQuantumList();
}

// Marks carry .hist-* classes that CSS colours from the tokens. Layout maths assumes the
// labels' --text-3xs (12-14px) and Geneva's ~8px advance per character at that size.
const LABEL_PX = 13;
const CHAR_PX = 8;

/** The scale's own pane, wide enough for a percentage and the line it labels. */
const AXIS_W = 56;
/** The bars start clear of the scale's rule rather than under it. */
const BAR_INSET = 3;

function histBox(): { W: number; H: number } {
  const parent = elHistSvg.parentElement;
  return { W: parent?.clientWidth ?? 400, H: parent?.clientHeight ?? 256 };
}

function paint(W: number, H: number, body: string, label: string): void {
  const svg = elHistSvg;
  svg.setAttribute('viewBox', `0 0 ${String(W)} ${String(H)}`);
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);
  svg.removeAttribute('aria-hidden');
  svg.innerHTML = body;
  elQuPlaceholder.style.display = 'none';
}

/**
 * Draw the scale beside the bars, at the heights they are drawn against.
 *
 * It sits outside the frame that scrolls, so the reader keeps the figures whatever part
 * of the distribution is on screen. `top` and `cH` come from the bars, which is what
 * lines the two drawings up.
 */
function paintAxis(H: number, top: number, cH: number, maxProb: number | null): void {
  const svg = elHistAxis;
  let body = '';
  if (maxProb != null) {
    for (const step of [0, 50, 100]) {
      const p = (maxProb * step) / 100;
      const y = (top + cH - (p / maxProb) * cH).toFixed(1);
      body += `<text class="hist-text hist-muted" x="${String(AXIS_W - 8)}" y="${y}"
        text-anchor="end" dominant-baseline="middle">${fp(p)}</text>`;
    }
  }
  body +=
    `<line class="hist-axis" x1="${String(AXIS_W - 1)}" y1="${String(top)}" ` +
    `x2="${String(AXIS_W - 1)}" y2="${(top + cH).toFixed(1)}"/>`;
  svg.setAttribute('viewBox', `0 0 ${String(AXIS_W)} ${String(H)}`);
  svg.setAttribute('width', String(AXIS_W));
  svg.setAttribute('height', String(H));
  svg.innerHTML = body;
}

export function drawEmptyHistogram(): void {
  // An empty, labelled frame — never placeholder bars that look like data.
  const { W, H } = histBox();
  const P = { t: 20, r: 12, b: 44, l: BAR_INSET };
  const cW = W - P.l - P.r,
    cH = H - P.t - P.b;
  const narrow = cW < 320;
  const msg = window.API_BASE
    ? narrow
      ? 'Counts appear after a run'
      : 'Measurement counts appear here after a quantum run'
    : narrow
      ? 'Solve, or pick a Gallery run'
      : 'Solve the puzzle, or pick a Gallery run, to see measurement counts';
  const s =
    `<g transform="translate(${String(P.l)},${String(P.t)})">` +
    `<line class="hist-axis" x1="0" y1="${String(cH)}" x2="${String(cW)}" y2="${String(cH)}"/>` +
    `<text class="hist-text hist-muted" x="${(cW / 2).toFixed(1)}" y="${(cH / 2).toFixed(1)}"
      text-anchor="middle">${msg}</text></g>`;
  paintAxis(H, P.t, cH, null);
  paint(W, H, s, `Measurement histogram: empty. ${msg}.`);
}

function fp(p: number): string {
  const v = p * 100;
  if (v === 0) return '0%';
  if (v < 0.1) return v.toFixed(3) + '%';
  if (v < 1.0) return v.toFixed(2) + '%';
  if (v < 10) return v.toFixed(1) + '%';
  return String(Math.round(v)) + '%';
}

// The 4×4 stipple the rest of the page fills a disabled or inapplicable surface with.
const DITHER =
  '<defs><pattern id="hist-dither" width="4" height="4" patternUnits="userSpaceOnUse">' +
  '<rect class="hist-dot" width="1" height="1"/><rect class="hist-dot" x="2" y="2" width="1" height="1"/>' +
  '</pattern></defs>';

export function drawHistogram({ entries, verified, totalOutcomes }: HistData): void {
  const n = entries.length;
  if (n === 0) {
    drawEmptyHistogram();
    return;
  }
  const box = histBox();
  // Every outcome gets a bar. Past what the frame holds the chart runs wider and the
  // frame scrolls, so the tail of the distribution stays on the page.
  // The scale holds a pane of its own at the left, so the bars have the rest.
  const W = Math.max(
    box.W - AXIS_W,
    BAR_INSET + 12 + entries.length * MIN_BAR_SLOT + GAP_AFTER_SOLUTIONS,
  );
  const bits = Math.max(...entries.map(([bs]) => bs.length));
  // Room under the axis for the bitstrings, set at 45°, plus the caption line.
  const labelDrop = Math.min(96, 8 + bits * CHAR_PX * 0.71);
  // The top holds the bracket over the solutions and the count above it. The left holds
  // what the first bitstring reaches back past its own bar.
  const P = {
    t: 30,
    r: 12,
    b: labelDrop + LABEL_PX + 10,
    l: BAR_INSET + Math.max(0, labelDrop - 8 - MIN_BAR_SLOT / 2),
  };
  const cW = W - P.l - P.r;

  const maxProb = entries[0][1];
  // The gap the divider sits in, wide enough to read as a break in the ranking.
  const solutionsShown = verified.length;
  // A run that turned up nothing else has no break to draw.
  const gap = solutionsShown && solutionsShown < n ? GAP_AFTER_SOLUTIONS : 0;
  const slot = (cW - gap) / n;
  const bW = Math.max(4, Math.min(44, slot * 0.72));
  // A 12px label needs ~14px of run; past that, label every k-th bar.
  const every = Math.max(1, Math.ceil((LABEL_PX + 2) / slot));

  const drawAt = (H: number): void => {
    const cH = H - P.t - P.b;
    let s = DITHER + `<g transform="translate(${String(P.l)},${String(P.t)})">`;

    // The figures for these lines are in the pane beside, which holds while this scrolls.
    for (const step of [0, 50, 100]) {
      const y = (cH - (step / 100) * cH).toFixed(1);
      s += `<line class="hist-grid" x1="0" y1="${y}" x2="${String(cW)}" y2="${y}"/>`;
    }

    // Solid bars are grids the clues accept; the rest are what the run also turned up.
    const solutions = new Set(verified.map(([bs]) => bs));
    entries.forEach(([bs, prob], i) => {
      // The bitstring key is server data landing in SVG markup — accept only
      // literal 0/1 strings (anything else is dropped).
      if (!/^[01]+$/.test(bs)) return;
      const on = solutions.has(bs);
      const bH = Math.max(1, (prob / maxProb) * cH);
      const bx = i * slot + (slot - bW) / 2 + (i >= solutionsShown ? gap : 0);
      const by = cH - bH;
      s += `<rect class="hist-bar${on ? '' : ' hist-below'}" x="${bx.toFixed(1)}" y="${by.toFixed(1)}"
        width="${bW.toFixed(1)}" height="${bH.toFixed(1)}"/>`;
      if (on && bW >= 30)
        s += `<text class="hist-text" x="${(bx + bW / 2).toFixed(1)}" y="${(by - 4).toFixed(1)}"
          text-anchor="middle">${fp(prob)}</text>`;
      if (i % every === 0) {
        const lx = (bx + bW / 2).toFixed(1);
        const ly = (cH + 6).toFixed(1);
        s += `<text class="hist-text hist-muted" x="${lx}" y="${ly}" text-anchor="end"
          dominant-baseline="hanging" transform="rotate(-45,${lx},${ly})">${bs}</text>`;
      }
    });

    // Which bars the clues accept, bracketed and counted over them the way the circuit
    // brackets its depth. Bars are ranked by how often they came back, so the bracket
    // also says whether the run put the solutions in front.
    if (solutionsShown) {
      const x1 = (slot - bW) / 2 - 3;
      const x2 = (solutionsShown - 1) * slot + (slot - bW) / 2 + bW + 3;
      const name = `${String(solutionsShown)} solution${solutionsShown === 1 ? '' : 's'}`;
      // Centred over a bracket of one bar, the count would hang off the left edge of the
      // chart, so it keeps half its own width from either end.
      const half = (name.length * CHAR_PX) / 2;
      const cx = Math.min(Math.max((x1 + x2) / 2, half), Math.max(half, cW - half));
      s += `<path class="hist-bracket" d="M${x1.toFixed(1)} -3 v-5 H${x2.toFixed(1)} v5"/>`;
      s += `<text class="hist-text hist-count" x="${cx.toFixed(1)}" y="-13">${name}</text>`;
    }

    s += `<line class="hist-axis" x1="0" y1="${String(cH)}" x2="${String(cW)}" y2="${String(cH)}"/>`;

    const lbl =
      totalOutcomes != null && totalOutcomes > n
        ? `top ${String(n)} of ${String(totalOutcomes)}`
        : String(n);
    const caption = `${lbl} outcome${n !== 1 ? 's' : ''}`;
    s += `</g>`;

    const top = entries[0];
    paintAxis(H, P.t, cH, maxProb);
    paint(
      W,
      H,
      s,
      `Measurement histogram: ${caption}. Most frequent ${top[0]} at ${fp(top[1])}; ` +
        `${String(verified.length)} of them satisfy the clues.`,
    );
  };

  // A scrollbar takes its height out of the frame, so the second pass draws into what
  // is left and keeps the bitstrings on screen.
  drawAt(box.H);
  const left = elHistSvg.parentElement?.clientHeight ?? box.H;
  if (left !== box.H) drawAt(left);
}

// Quantum solutions list renderer
export function renderQuantumList(): void {
  elQuList.innerHTML = '';
  if (!state.histData) {
    elQuList.appendChild(elQuSolPlaceholder);
    elQuSolPlaceholder.textContent = 'Solve the puzzle to see solutions.';
    return;
  }

  const { verified, rows, cols } = state.histData;
  const sz = getBestSolSize(rows, cols);

  if (verified.length === 0) {
    elQuList.appendChild(elQuSolPlaceholder);
    elQuSolPlaceholder.textContent = 'No solution among the measured grids.';
    return;
  }

  verified.forEach(([bs, prob]) => {
    const bsGrid = asGrid(bs);
    const wrap = document.createElement('div');
    wrap.className = 'sol-grid-wrap';

    const lbl = document.createElement('div');
    lbl.className = 'sol-grid-label';
    lbl.textContent = (prob * 100).toFixed(1) + '%';
    wrap.appendChild(lbl);

    wrap.appendChild(solutionTable(bsGrid, rows, cols, sz));
    elQuList.appendChild(wrap);
  });
}

// Metrics renderer

/**
 * The table with its figures taken out.
 *
 * The frame stays: it is what the page is for, and a reader should be able to see what
 * the comparison will ask before asking it. Only the answers wait for a run.
 */
export function clearMetrics(): void {
  renderMetrics(null, true);
}

/**
 * What each label means, keyed by the label. Every row carries one.
 *
 * Written for a reader with no physics: what the figure counts, in what units, and what
 * it is an estimate of. Where a column's units differ from its neighbours', the note
 * says so rather than letting the shared label imply otherwise.
 */
const NOTES: Record<string, string> = {
  Solutions:
    'Grids that satisfy every row and column clue. The count comes from the classical ' +
    'solver, and the oracle in the measured circuit marks exactly those grids.',
  'Clue checks':
    'How many times each method asks the clues a question: grids checked, row placements ' +
    'tried, or Grover rounds. One question is a different size in each column: the 17 rounds ' +
    'here are the whole speedup, and the device rows below are what they cost.',
  'Per clue check':
    'What one question costs. Exhaustive: two-input gates to test a whole grid. ' +
    'Backtracking: at most that, since it stops at the first blocked column. Grover: ' +
    'two-qubit gates per round on the fitted circuit.',
  'Per extra cell':
    'How the count of checks grows when the grid gains one cell. Exhaustive doubles; ' +
    'Grover grows by the square root of 2. Backtracking has no fixed rate, because its ' +
    'count depends on the clues.',
  'P(solution), ideal':
    'Chance that one run ends on a solution, with no noise. The classical methods are ' +
    "certain. Grover's figure is the exact formula at its best round count; more rounds " +
    'would lower it again.',
  Qubits:
    'One qubit per cell. The measured circuit marks the known answers and needs no ' +
    'working qubits; an oracle that tested the clues itself would need one more per line.',
  'Two-qubit gates':
    'Gates acting on two qubits at once, the error-prone kind, counted over the whole ' +
    'circuit after it was fitted to the device. A lower bound, since the oracle here ' +
    'already holds the answers.',
  'Per extra cell, measured':
    'How the two-qubit gate count grew per added cell, against the next smaller measured ' +
    'board with the same number of solutions. One step between two boards, not a rate: the ' +
    'steps measured so far run from 2.17x to 4.14x. A dash means there was nothing to ' +
    'compare it with.',
  'Spacetime (qubit-layers)':
    'Width times depth: every qubit held for as long as the circuit runs. Estimates of what ' +
    'a quantum attack would cost are quoted this way. It charges the circuit for qubits it ' +
    'holds idle, so it reads harder on the circuit than a gate count does.',
  'Depth (layers)':
    'Layers of gates the circuit runs in sequence, every round included, after it was ' +
    `fitted to the device. Best of the ${String(COST_SEEDS)} seeds tried, which differed ` +
    'by under 2%.',
  'Device budget (layers)':
    `A working figure of ${String(DEPTH_BUDGET)} layers, what a current device runs ` +
    'before noise takes over. Assumed rather than read off a device. The "over" figure ' +
    'is the depth above divided by it.',
  'Rounds that fit':
    "Whole Grover rounds that fit inside the budget: this circuit's depth per round " +
    'against the rounds it needs. Zero means noise takes over before one round finishes. ' +
    'The backend runs one truncated round rather than none.',
  'P(solution), at chance':
    'The chance of landing on a solution by picking a grid at random, which is what a ' +
    'device returns once the circuit outruns its coherence.',
};

/** What each method is, on the header that names it. */
const COLUMN_NOTES: Record<string, string> = {
  Metric:
    'What each row counts. The three columns beside it are the methods being compared, ' +
    'and every label carries its own note.',
  Exhaustive:
    'Checks every possible grid against the clues, so it is certain to find every ' +
    'solution. How many checks that takes follows the cell count alone.',
  Backtracking:
    "This page's own solver. It places one row pattern at a time and drops any branch " +
    'that leaves a column with no legal pattern left, so its counts move with the puzzle.',
  Grover:
    'Quantum search, simulated here. The probabilities come from an exact noiseless ' +
    'formula run in the browser, and the device figures below are estimates, not a run.',
};

/** What a section covers, on the name down its side. */
const SPINE_NOTES: Record<string, string> = {
  Search:
    'The work each method does to find the solutions, counted in its own units: grids ' +
    'checked, row placements tried, or Grover rounds. Those units are not the same size.',
  'If it ran on a device':
    `Estimates, not a run. Qiskit fitted the circuit to ${COST_TARGET}, a snapshot of an ` +
    `IBM Heron, at optimization level ${String(COST_OPTIMIZATION)}, best of ` +
    `${String(COST_SEEDS)} seeds. The oracle marks the answers it already holds, so every ` +
    'figure here is a lower bound.',
};

/**
 * What produced the figures in the measured group, and what they are figures of.
 *
 * A transpiled depth means nothing without the device it was transpiled for and the
 * settings that got it: the same circuit swings by a tenth across seeds alone. The
 * target names Qiskit's snapshot of the Heron it was fitted to, which is what the
 * figures were measured against. The oracle already holds the answer, so the cost is
 * the floor rather than the price.
 */
const DEVICE_META =
  `${COST_TARGET} \u00b7 opt ${String(COST_OPTIMIZATION)} \u00b7 ` +
  `best of ${String(COST_SEEDS)} seeds \u00b7 lower bound \u00b7 answer-marking oracle`;

function cell(tr: HTMLTableRowElement, text: string | number): HTMLTableCellElement {
  const td = tr.insertCell();
  td.textContent = String(text);
  return td;
}

/**
 * The section's name, down a spine to the left of the rows it covers.
 *
 * Rotated rather than set across the table: the name belongs to every row under it, and
 * a band spanning the columns cut the figures in half to say so. The circuit diagram
 * names its boxes the same way.
 */
function addSpine(body: HTMLTableSectionElement, label: string, meta: string): void {
  const first = body.rows.item(0);
  if (!first) return;
  const th = document.createElement('th');
  th.scope = 'rowgroup';
  th.className = 'spine';
  // What the rotated name has no room for: what the section covers, then the settings
  // the figures came from.
  const note = SPINE_NOTES[label];
  if (note) th.title = meta ? `${note} (${meta})` : note;
  const name = document.createElement('span');
  name.textContent = label;
  th.append(name);
  th.rowSpan = body.rows.length;
  first.insertBefore(th, first.firstChild);
}

/**
 * One metric, plus the note row it opens.
 *
 * A label with a note becomes a button rather than carrying a title: a tooltip is
 * invisible to touch and to the keyboard, which is most of the people the note is for.
 */
function metricRow(
  body: HTMLTableSectionElement,
  label: string,
  values: (string | number)[],
  naSpan = false,
): void {
  const tr = body.insertRow();
  tr.className = 'metric';
  const th = document.createElement('th');
  th.scope = 'row';
  th.textContent = label;
  const note = NOTES[label];
  if (note) {
    th.title = note;
    th.className = 'has-note';
  }
  tr.append(th);
  if (naSpan) naCell(tr);
  for (const v of values) cell(tr, v);
}

/** The classical half of a device row: there is no device here, and the stipple says so. */
function naCell(tr: HTMLTableRowElement): void {
  const td = tr.insertCell();
  td.colSpan = 2;
  td.className = 'na';
  const label = document.createElement('span');
  label.className = 'sr-only';
  label.textContent = 'not applicable';
  td.append(label);
}

/**
 * The seven rows a device answers for, or the one line saying why it cannot.
 *
 * Blank, they stand as the questions a run will put; measured, they answer them.
 */
function deviceRows(
  body: HTMLTableSectionElement,
  ctx: {
    hw: HardwareCost | null;
    cells: number;
    found: number;
    work: number;
    blank: boolean;
    growth: string | null | false;
    roundGrowth: number | null;
  },
  v: (values: (string | number)[]) => (string | number)[],
): void {
  const { hw, cells, found, work, blank, growth, roundGrowth } = ctx;
  if (!hw && !blank) {
    const tr = body.insertRow();
    tr.className = 'metrics-unmeasured';
    const td = tr.insertCell();
    td.colSpan = 4;
    td.textContent =
      'Not measured for this board. Transpiling one costs more than the figure is worth; ' +
      'the circuit beside this carries the counts as written, before any device sees them.';
    return;
  }
  const perRound = hw ? hw.depth / hw.iterations : 0;
  const rows: [string, string | number][] = [
    ['Qubits', cells],
    ['Two-qubit gates', hw ? hw.two_qubit.toLocaleString() : ''],
    ['Per extra cell, measured', growth || '—'],
    ['Depth (layers)', hw ? hw.depth.toLocaleString() : ''],
    ['Spacetime (qubit-layers)', hw ? (cells * hw.depth).toLocaleString() : ''],
    [
      'Device budget (layers)',
      hw ? `${String(DEPTH_BUDGET)} (${Math.round(overBudget(hw)).toLocaleString()}x over)` : '',
    ],
    [
      'Rounds that fit',
      hw ? `${String(Math.floor(DEPTH_BUDGET / perRound))} of ${String(hw.iterations)}` : '',
    ],
    // The same question the ideal row asks: the chance of landing on any solution.
    ['P(solution), at chance', `${((100 * Math.max(found, 1)) / 2 ** cells).toFixed(1)}%`],
  ];
  for (const [label, value] of rows) metricRow(body, label, v([value]), true);
  if (hw && !blank) crossoverNote(body, { hw, cells, work, roundGrowth });
}

/**
 * Where the two costs stand against each other, in one line under the figures.
 *
 * Which unit is charged decides the answer, so the line gives all three rather than the
 * one that makes the point: two-qubit gates against classical gates is the closest thing
 * to like for like, and width times depth charges the circuit for every qubit it holds
 * idle while the classical side runs on one processor with no width at all.
 */
function crossoverNote(
  body: HTMLTableSectionElement,
  ctx: { hw: HardwareCost; cells: number; work: number; roundGrowth: number | null },
): void {
  const { hw, cells, work, roundGrowth } = ctx;
  if (work <= 0) return;
  const each = (n: number): string => `${(n / work).toFixed(n / work < 10 ? 2 : 0)}x`;
  const rate =
    roundGrowth == null
      ? ''
      : ` A round costs ${roundGrowth.toFixed(2)}x more per cell than on the next board down, which is what` +
        ' compiling the marking oracle onto a fixed device costs rather than a rate the search sets.';
  const tr = body.insertRow();
  tr.className = 'metrics-note';
  const td = tr.insertCell();
  td.colSpan = 4;
  td.textContent =
    `Against this board's ${work.toLocaleString()} classical gate-steps the circuit comes to ` +
    `${each(hw.two_qubit)} by two-qubit gates, ${each(hw.gates)} by all gates, and ` +
    `${each(cells * hw.depth)} by qubit-layers, so the unit charged decides the comparison.${rate}`;
}

function renderMetrics(report: BenchmarkReport | null | undefined, blank = false): void {
  const el = must('metrics-pane');
  el.innerHTML = '';

  /** Figures wait for a run; the labels and the shape of the table do not. */
  const v = (values: (string | number)[]): (string | number)[] =>
    blank ? values.map(() => '') : values;

  const puzzle = getCurrentPuzzle();
  const rows = puzzle.row_clues.length;
  const cols = puzzle.col_clues.length;
  const cells = rows * cols;
  const local = solveLocal(puzzle.row_clues, puzzle.col_clues);
  const found = report?.classical?.solutions_found ?? local.solutions.length;
  const cost = classicalCost(puzzle.row_clues, puzzle.col_clues);
  const hw = hardwareCost(rows, cols, found);
  // No solutions means nothing to amplify, and optimalIterations says so with a zero
  // rather than a count that would rotate the state nowhere useful.
  const iterations = optimalIterations(found, cells);
  const ideal = groverOutcome(found, cells, iterations).markedProbability;

  const tbl = document.createElement('table');
  tbl.className = 'metrics-table';

  const head = tbl.createTHead().insertRow();
  // The corner over the spine names nothing, the way a table's top left never does.
  head.insertCell().className = 'spine-corner';
  for (const h of ['Metric', 'Exhaustive', 'Backtracking', 'Grover']) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = h;
    const note = COLUMN_NOTES[h];
    if (note) {
      th.title = note;
      th.className = 'has-note';
    }
    head.append(th);
  }

  const search = tbl.createTBody();
  search.className = 'metrics-group';
  metricRow(search, 'Solutions', v([found, found, found]));
  metricRow(
    search,
    'Clue checks',
    v([
      formatCount(2 ** cells, cells),
      local.capped ? '—' : local.clueChecks.toLocaleString(),
      iterations.toLocaleString(),
    ]),
  );
  metricRow(
    search,
    'Per clue check',
    v([
      `${cost.predicateGates} gates`,
      local.capped ? '—' : `up to ${String(cost.predicateGates)} gates`,
      hw ? `${Math.round(hw.two_qubit / hw.iterations).toLocaleString()} 2q` : '—',
    ]),
  );
  metricRow(search, 'Per extra cell', v(['2x', '—', '1.41x']));
  metricRow(
    search,
    'P(solution), ideal',
    v(['100%', found > 0 ? '100%' : '—', found > 0 ? (ideal * 100).toFixed(1) + '%' : '—']),
  );

  const device = tbl.createTBody();
  device.className = 'metrics-group metrics-group--device';

  deviceRows(
    device,
    {
      hw,
      cells,
      found,
      work: cost.work,
      blank,
      growth: hw && measuredGrowth(rows, cols, found),
      roundGrowth: hw && measuredRoundGrowth(rows, cols, found),
    },
    v,
  );

  addSpine(
    search,
    'Search',
    `${String(cells)} cells, ${formatCount(2 ** cells, cells)} candidates`,
  );
  addSpine(device, 'If it ran on a device', hw ? DEVICE_META : '');

  el.append(tbl);
  el.classList.add('visible');
}

// Benchmark result renderer

/** Annotate a section's rule with what its own run cost. */
function setRuleMeta(id: string, text: string, hover = ''): void {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  if (hover) el.title = hover;
  else el.removeAttribute('title');
}

/** Everything a run's rules should say, cleared and re-set together. */
export function setRunMeta(meta: {
  classical?: string;
  quantum?: string;
  histogram?: string;
  histogramHover?: string;
}): void {
  setRuleMeta('cl-meta', meta.classical ?? '');
  setRuleMeta('qu-meta', meta.quantum ?? '');
  setRuleMeta('hist-meta', meta.histogram ?? '', meta.histogramHover);
}

export function renderBenchmark({
  report,
  solutions,
  qu_counts,
  qu_counts_per_trial,
  rows,
  cols,
}: BenchmarkPayload): void {
  // Use last trial counts if multi-trial
  const counts = qu_counts_per_trial
    ? qu_counts_per_trial[qu_counts_per_trial.length - 1]
    : qu_counts;

  renderClassical({ solutions, rows, cols });
  renderQuantum(counts, rows, cols);
  renderMetrics(report);
}
