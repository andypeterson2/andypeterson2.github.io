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
  elThresholdInput,
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
} from './hardware-cost';
import { solveLocal } from './classical-solver';
import { groverOutcome, optimalIterations } from './grover-sim';

const MAX_DISPLAY = 30;

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
  elThresholdInput.disabled = true;
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
function computeThreshold(rows: number, cols: number): number {
  const numVars = rows * cols;
  const baseline = 1.0 / Math.pow(2, numVars);
  return Math.max(3.0 * baseline, 0.005);
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
  let entries: [string, number][] = Object.entries(counts).map(([bs, cnt]) => [
    bs,
    total > 0 ? cnt / total : 0,
  ]);
  entries.sort((a, b) => b[1] - a[1]);
  const totalOutcomes = entries.length;
  entries = entries.slice(0, MAX_DISPLAY);

  const threshold = state.userThreshold ?? computeThreshold(rows, cols);

  state.histData = { entries, threshold, rows, cols, totalOutcomes };
  elThresholdInput.disabled = false;
  elQuPlaceholder.style.display = 'none';

  const pctVal = threshold * 100;
  const pctStr = pctVal.toFixed(pctVal < 1 ? 2 : 1);
  elThresholdInput.value = pctStr;

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
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);
  svg.removeAttribute('aria-hidden');
  svg.innerHTML = body;
  elQuPlaceholder.style.display = 'none';
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
      ? 'Pick a Gallery run'
      : 'Pick a Gallery run to see real quantum measurement counts';
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

export function drawHistogram({ entries, threshold, totalOutcomes }: HistData): void {
  const n = entries.length;
  if (n === 0) {
    drawEmptyHistogram();
    return;
  }
  const { W, H } = histBox();
  const bits = Math.max(...entries.map(([bs]) => bs.length));
  // Room under the axis for the bitstrings, set at 45°, plus the caption line.
  const labelDrop = Math.min(96, 8 + bits * CHAR_PX * 0.71);
  const P = { t: 22, r: 12, b: labelDrop + LABEL_PX + 10, l: 56 };
  const cW = W - P.l - P.r,
    cH = H - P.t - P.b;

  const maxProb = entries[0][1];
  const slot = cW / n;
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

  let above = 0;
  entries.forEach(([bs, prob], i) => {
    // The bitstring key is server data landing in SVG markup — accept only
    // literal 0/1 strings (anything else is dropped).
    if (!/^[01]+$/.test(bs)) return;
    const on = prob >= threshold;
    if (on) above++;
    const bH = Math.max(1, (prob / maxProb) * cH);
    const bx = i * slot + (slot - bW) / 2;
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

  if (threshold > 0 && threshold <= maxProb) {
    const ty = (cH - (threshold / maxProb) * cH).toFixed(1);
    s += `<line class="hist-threshold" x1="0" y1="${ty}" x2="${String(cW)}" y2="${ty}"/>`;
    s += `<text class="hist-text hist-strong" x="${(cW - 2).toFixed(1)}" y="${(+ty - 5).toFixed(1)}"
      text-anchor="end">threshold ${fp(threshold)}</text>`;
  }

  s += axes(cW, cH);

  const lbl =
    totalOutcomes != null && totalOutcomes > n
      ? `top ${String(n)} of ${String(totalOutcomes)}`
      : String(n);
  const caption = `${lbl} outcome${n !== 1 ? 's' : ''}`;
  s += `<text class="hist-text hist-muted" x="${(cW / 2).toFixed(1)}" y="${(cH + P.b - 6).toFixed(1)}"
    text-anchor="middle">${caption}</text>`;
  s += `</g>`;

  const top = entries[0];
  paint(
    W,
    H,
    s,
    `Measurement histogram: ${caption}. Most frequent ${top[0]} at ${fp(top[1])}; ` +
      `${String(above)} at or above the ${fp(threshold)} threshold.`,
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

  const { entries, threshold, rows, cols } = state.histData;
  const above = entries.filter(([, prob]) => prob >= threshold);
  const sz = getBestSolSize(rows, cols);

  if (above.length === 0) {
    elQuList.appendChild(elQuSolPlaceholder);
    elQuSolPlaceholder.textContent = 'No solutions above threshold.';
    return;
  }

  above.forEach(([bs, prob]) => {
    const bsGrid = bs.split('').reverse().join('');
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
function clearMetrics(): void {
  const el = must('metrics-pane');
  el.innerHTML = '';
  el.classList.remove('visible');
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
function addSpine(body: HTMLTableSectionElement, label: string): void {
  const first = body.rows.item(0);
  if (!first) return;
  const th = document.createElement('th');
  th.scope = 'rowgroup';
  th.className = 'spine';
  const name = document.createElement('span');
  name.textContent = label;
  th.append(name);
  first.insertBefore(th, first.firstChild);
  syncSpine(body);
}

/**
 * Hold the spine to the rows it covers.
 *
 * A note row is display:none until it is opened, and a row that is not laid out is not
 * spanned, so the count has to be taken again every time one opens.
 */
function syncSpine(body: HTMLTableSectionElement): void {
  const th = body.querySelector<HTMLTableCellElement>('th.spine');
  if (!th) return;
  th.rowSpan = [...body.rows].filter(
    (r) => !r.classList.contains('metric-note') || r.classList.contains('open'),
  ).length;
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
  const note = NOTES[label];

  if (note) {
    const id = `note-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'metric-toggle';
    button.textContent = label;
    // The same words a press opens, for a pointer that only hovers.
    button.title = note;
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', id);
    th.append(button);
    tr.append(th);

    if (naSpan) naCell(tr);
    for (const v of values) cell(tr, v);

    const noteRow = body.insertRow();
    noteRow.className = 'metric-note';
    noteRow.id = id;
    const td = noteRow.insertCell();
    td.colSpan = 4;
    td.textContent = note;

    button.addEventListener('click', () => {
      const open = noteRow.classList.toggle('open');
      button.setAttribute('aria-expanded', String(open));
      syncSpine(body);
    });
    return;
  }

  th.textContent = label;
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

function renderMetrics(report: BenchmarkReport | null | undefined): void {
  const el = must('metrics-pane');
  el.innerHTML = '';

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
  metricRow(search, 'Solutions', [found, found, found]);
  metricRow(search, 'Clue checks', [
    formatCount(2 ** cells, cells),
    local.capped ? '—' : local.clueChecks.toLocaleString(),
    iterations.toLocaleString(),
  ]);
  metricRow(search, 'Per clue check', [
    `${cost.predicateGates} gates`,
    local.capped ? '—' : `\u2264 ${String(cost.predicateGates)} gates`,
    hw ? `${Math.round(hw.two_qubit / hw.iterations).toLocaleString()} 2q` : '—',
  ]);
  metricRow(search, 'Per extra cell', ['2\u00d7', '—', '1.41\u00d7']);
  metricRow(search, 'P(solution), ideal', [
    '100%',
    found > 0 ? '100%' : '—',
    found > 0 ? (ideal * 100).toFixed(1) + '%' : '—',
  ]);

  const device = tbl.createTBody();
  device.className = 'metrics-group metrics-group--device';

  if (hw) {
    const perCell = measuredGrowth(rows, cols, found);
    metricRow(device, 'Qubits', [cells], true);
    metricRow(device, 'Two-qubit gates', [hw.two_qubit.toLocaleString()], true);
    metricRow(device, 'Per extra cell, measured', [perCell ?? '—'], true);
    metricRow(device, 'Depth (layers)', [hw.depth.toLocaleString()], true);
    metricRow(
      device,
      'Device budget (layers)',
      [`${String(DEPTH_BUDGET)} (${Math.round(overBudget(hw)).toLocaleString()}\u00d7 over)`],
      true,
    );
    metricRow(
      device,
      'Rounds that fit',
      [
        `${String(Math.floor(DEPTH_BUDGET / (hw.depth / hw.iterations)))} of ${String(hw.iterations)}`,
      ],
      true,
    );
    metricRow(device, 'P(solution), at chance', [`~${(100 / 2 ** cells).toFixed(1)}%`], true);
  } else {
    const tr = device.insertRow();
    tr.className = 'metrics-unmeasured';
    const td = tr.insertCell();
    td.colSpan = 4;
    td.textContent =
      'Not measured for this board. Transpiling one costs more than the figure is worth; ' +
      'the circuit below carries the counts as written, before any device sees them.';
  }

  addSpine(search, 'Search');
  addSpine(device, 'On the device');

  el.append(tbl);
  el.append(
    legend([
      ['Search', `${String(cells)} cells, ${formatCount(2 ** cells, cells)} candidates`],
      ['On the device', hw ? DEVICE_META : ''],
    ]),
  );
  el.classList.add('visible');
}

/** What each section's name would not fit: the qualifiers its figures are figures of. */
function legend(sections: [string, string][]): HTMLElement {
  const box = document.createElement('div');
  box.className = 'metrics-legend';
  for (const [label, meta] of sections) {
    if (!meta) continue;
    const line = document.createElement('p');
    const name = document.createElement('span');
    name.className = 'legend-name';
    name.textContent = label;
    line.append(name, document.createTextNode(` \u00b7 ${meta}`));
    box.append(line);
  }
  return box;
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
