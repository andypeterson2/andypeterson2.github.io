/**
 * Solver interaction & result rendering (classical, quantum,
 * histogram).
 */

import {
  state,
  $,
  must,
  elHistSvg,
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

function histBox(): { W: number; H: number } {
  const parent = elHistSvg.parentElement;
  return { W: parent?.clientWidth ?? 400, H: parent?.clientHeight ?? 260 };
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
  centreOnContent(svg);
  elQuPlaceholder.style.display = 'none';
}

/**
 * Sit the drawing in the middle of its frame.
 *
 * The chart reserves room for labels that turn out not to need all of it — the axis
 * figures on one side, the rotated bitstrings under the bars — which leaves it low and
 * to one side of its box. Measuring what was actually drawn and framing that instead
 * centres it whatever the labels came to.
 */
function centreOnContent(svg: SVGSVGElement): void {
  let box: DOMRect;
  try {
    box = svg.getBBox();
  } catch {
    // No layout yet (a hidden pane); the declared viewBox still stands.
    return;
  }
  if (box.width <= 0 || box.height <= 0) return;
  const pad = 6;
  svg.setAttribute(
    'viewBox',
    `${(box.x - pad).toFixed(1)} ${(box.y - pad).toFixed(1)} ` +
      `${(box.width + pad * 2).toFixed(1)} ${(box.height + pad * 2).toFixed(1)}`,
  );
}

function axes(cW: number, cH: number): string {
  return (
    `<line class="hist-axis" x1="0" y1="0" x2="0" y2="${String(cH)}"/>` +
    `<line class="hist-axis" x1="0" y1="${String(cH)}" x2="${String(cW)}" y2="${String(cH)}"/>`
  );
}

export function drawEmptyHistogram(): void {
  // An empty, labelled frame — never placeholder bars that look like data.
  const { W, H } = histBox();
  const P = { t: 20, r: 12, b: 44, l: 56 };
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
    axes(cW, cH) +
    `<text class="hist-text hist-muted" x="${(cW / 2).toFixed(1)}" y="${(cH / 2).toFixed(1)}"
      text-anchor="middle">${msg}</text></g>`;
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

// A 2×2 checkerboard: the System-6 50% grey, in ink on paper.
const DITHER =
  '<defs><pattern id="hist-dither" width="2" height="2" patternUnits="userSpaceOnUse">' +
  '<rect class="hist-dot" width="1" height="1"/><rect class="hist-dot" x="1" y="1" width="1" height="1"/>' +
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
  const W = Math.max(box.W, 56 + 12 + entries.length * MIN_BAR_SLOT + GAP_AFTER_SOLUTIONS);
  const H = box.H;
  const bits = Math.max(...entries.map(([bs]) => bs.length));
  // Room under the axis for the bitstrings, set at 45°, plus the caption line.
  const labelDrop = Math.min(96, 8 + bits * CHAR_PX * 0.71);
  const P = { t: 22, r: 12, b: labelDrop + LABEL_PX + 10, l: 56 };
  const cW = W - P.l - P.r,
    cH = H - P.t - P.b;

  const maxProb = entries[0][1];
  // The gap the divider sits in, wide enough to read as a break in the ranking.
  const solutionsShown = verified.length && verified.length < n ? verified.length : 0;
  const slot = (cW - (solutionsShown ? GAP_AFTER_SOLUTIONS : 0)) / n;
  const bW = Math.max(4, Math.min(44, slot * 0.72));
  // A 12px label needs ~14px of run; past that, label every k-th bar.
  const every = Math.max(1, Math.ceil((LABEL_PX + 2) / slot));

  let s = DITHER + `<g transform="translate(${String(P.l)},${String(P.t)})">`;

  for (const step of [0, 50, 100]) {
    const p = (maxProb * step) / 100;
    const y = (cH - (p / maxProb) * cH).toFixed(1);
    s += `<line class="hist-grid" x1="0" y1="${y}" x2="${String(cW)}" y2="${y}"/>`;
    s += `<text class="hist-text hist-muted" x="-6" y="${y}" text-anchor="end"
      dominant-baseline="middle">${fp(p)}</text>`;
  }

  // Solid bars are grids the clues accept; the rest are what the run also turned up.
  const solutions = new Set(verified.map(([bs]) => bs));
  entries.forEach(([bs, prob], i) => {
    // The bitstring key is server data landing in SVG markup — accept only
    // literal 0/1 strings (anything else is dropped).
    if (!/^[01]+$/.test(bs)) return;
    const on = solutions.has(bs);
    const bH = Math.max(1, (prob / maxProb) * cH);
    const bx =
      i * slot +
      (slot - bW) / 2 +
      (solutionsShown && i >= solutionsShown ? GAP_AFTER_SOLUTIONS : 0);
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

  // Where the solutions stop. Bars are ranked by how often they came back, so this
  // says at a glance whether the run put them in front.
  if (solutionsShown) {
    const dx = solutionsShown * slot + GAP_AFTER_SOLUTIONS / 2;
    s += `<line class="hist-divide" x1="${dx.toFixed(1)}" y1="0" x2="${dx.toFixed(1)}" y2="${String(cH)}"/>`;
    // Both read left to right from their own side, so one solution does not push its
    // own label off the chart.
    s += `<text class="hist-text hist-divide-label" x="2" y="4">solutions</text>`;
    s += `<text class="hist-text hist-divide-label" x="${(dx + 5).toFixed(1)}" y="4">the rest</text>`;
  }

  s += axes(cW, cH);

  const lbl =
    totalOutcomes != null && totalOutcomes > n
      ? `top ${String(n)} of ${String(totalOutcomes)}`
      : String(n);
  const caption = `${lbl} outcome${n !== 1 ? 's' : ''}`;
  s += `</g>`;

  const top = entries[0];
  paint(
    W,
    H,
    s,
    `Measurement histogram: ${caption}. Most frequent ${top[0]} at ${fp(top[1])}; ` +
      `${String(verified.length)} of them satisfy the clues.`,
  );
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

/** A row's note, keyed by its label. Absent means the label is not pressable. */
const NOTES: Record<string, string> = {
  'Clue checks':
    'How many times each method asks the clues a question. Exhaustive counts to the ' +
    "certainty Grover reaches, not the 256 it would average. Backtracking is this page's " +
    'own solver, so its count moves with the puzzle where the other two follow only the ' +
    'cell count and the number of solutions.',
  'Per clue check':
    'One backtracking placement stops at the first column left with nothing, so it costs ' +
    'at most a whole-grid check. Grover pays a full transpiled oracle every time.',
  'Per extra cell':
    'What one more cell does to each column. Exhaustive doubles; Grover takes the square ' +
    'root of that. The measured row below is the same question asked of the built circuit.',
  'Per extra cell, measured':
    'Two-qubit gates grew 1,900 to 19,357 from six cells to nine. Per-call cost is not ' +
    'constant yet: the multi-controlled gates and the routing onto a heavy-hex device both ' +
    'grow with the register.',
  'Rounds that fit':
    'How many whole iterations sit inside the depth budget. The backend runs one truncated ' +
    'round rather than none.',
  'P(solution), at chance':
    'One solution among the states — what a device returns once the circuit outruns its coherence.',
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
  // The qualifiers the rotated name has no room for.
  if (meta) th.title = `${label} — ${meta}`;
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
  ctx: { hw: HardwareCost | null; cells: number; blank: boolean; growth: string | null | false },
  v: (values: (string | number)[]) => (string | number)[],
): void {
  const { hw, cells, blank, growth } = ctx;
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
    [
      'Device budget (layers)',
      hw ? `${String(DEPTH_BUDGET)} (${Math.round(overBudget(hw)).toLocaleString()}x over)` : '',
    ],
    [
      'Rounds that fit',
      hw ? `${String(Math.floor(DEPTH_BUDGET / perRound))} of ${String(hw.iterations)}` : '',
    ],
    ['P(solution), at chance', `${(100 / 2 ** cells).toFixed(1)}%`],
  ];
  for (const [label, value] of rows) metricRow(body, label, v([value]), true);
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

  deviceRows(device, { hw, cells, blank, growth: hw && measuredGrowth(rows, cols, found) }, v);

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
