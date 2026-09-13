/* =============================================================
   Solver interaction & result rendering (classical, quantum,
   histogram).
   ============================================================= */

import {
  state,
  must,
  elHistSvg,
  elQuPlaceholder,
  elClPlaceholder,
  elQuList,
  elQuSolPlaceholder,
  elThresholdInput,
  type HistData,
} from './state';
import { getBestSolSize } from './grid';

const MAX_DISPLAY = 30;

// ── Wire shapes (hand-derived from the nonogram backend's payloads) ──────────

export interface ClassicalReport {
  solutions_found?: number;
  peak_memory_kb?: number | null;
}

export interface QuantumReport {
  solutions_found?: number;
  num_qubits?: number;
  circuit_depth?: number;
  grover_iterations?: number;
  top_result_probability?: number | null;
  peak_memory_kb?: number | null;
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

// ── Helpers ────────────────────────────────────────────────────
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

// ── Classical result renderer ──────────────────────────────────
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

// ── Quantum histogram & solutions ──────────────────────────────
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

// The histogram is drawn in the design system, not beside it (audit M29): every mark
// carries a class that CSS colours from the tokens (app.astro, .hist-*), labels are
// Geneva at --text-3xs (12px and up), and there's no colour to lint here at all.
// Bars at or above the threshold are ink; below it, a 50% dither with an ink edge.
// Layout maths assumes the label size: --text-3xs renders 12-14px, and Geneva's
// advance at that size is about 8px a character.
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
  // An empty, labelled frame — never placeholder bars that look like data (H7).
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
    // literal 0/1 strings (anything else is dropped, not escaped).
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

// ── Quantum solutions list renderer ───────────────────────────
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

// ── Metrics renderer ────────────────────────────────────────────
export function clearMetrics(): void {
  const el = must('metrics-pane');
  el.innerHTML = '';
  el.classList.remove('visible');
}

function fmtTime(t: number | null | undefined): string {
  if (t == null) return '—';
  return t < 1 ? (t * 1000).toFixed(1) + ' ms' : t.toFixed(3) + ' s';
}

function fmtAvg(times: number[] | null | undefined): string {
  if (!times?.length) return '—';
  const avg = times.reduce((a, b) => a + b) / times.length;
  let s = fmtTime(avg);
  if (times.length >= 2) {
    const mean = avg;
    const sd = Math.sqrt(times.reduce((a, b) => a + (b - mean) ** 2, 0) / (times.length - 1));
    s += ` ± ${fmtTime(sd)}`;
  }
  return s;
}

export function renderMetrics(
  report: BenchmarkReport | null | undefined,
  cl_times: number[] | null | undefined,
  qu_times: number[] | null | undefined,
): void {
  const el = must('metrics-pane');
  el.innerHTML = '';

  const cl = report?.classical;
  const qu = report?.quantum;
  const numVars = report?.num_variables;

  const tbl = document.createElement('table');
  tbl.className = 'metrics-table';

  const thead = tbl.createTHead();
  const hr = thead.insertRow();
  for (const h of ['Metric', 'Classical', 'Quantum']) {
    const th = document.createElement('th');
    th.textContent = h;
    hr.appendChild(th);
  }

  const tbody = tbl.createTBody();

  function row(label: string, cv: string | number, qv: string | number): void {
    const tr = tbody.insertRow();
    const tdL = tr.insertCell();
    tdL.className = 'metric-label';
    tdL.textContent = label;
    tr.insertCell().textContent = String(cv);
    tr.insertCell().textContent = String(qv);
  }

  row('Variables', numVars ?? '—', numVars ?? '—');
  row(
    'Search space',
    numVars != null ? (2 ** numVars).toLocaleString() : '—',
    numVars != null ? (2 ** numVars).toLocaleString() : '—',
  );
  row('Solve time', fmtAvg(cl_times), fmtAvg(qu_times));
  row('Solutions found', cl?.solutions_found ?? '—', qu?.solutions_found ?? '—');
  row('Qubits', '—', qu?.num_qubits ?? '—');
  row('Circuit depth', '—', qu?.circuit_depth?.toLocaleString() ?? '—');
  row('Grover iterations', '—', qu?.grover_iterations ?? '—');
  row(
    'Top probability',
    '—',
    qu?.top_result_probability != null ? (qu.top_result_probability * 100).toFixed(1) + '%' : '—',
  );
  row(
    'Peak memory',
    cl?.peak_memory_kb != null ? cl.peak_memory_kb.toFixed(1) + ' KB' : '—',
    qu?.peak_memory_kb != null ? qu.peak_memory_kb.toFixed(1) + ' KB' : '—',
  );

  el.appendChild(tbl);
  el.classList.add('visible');
}

// ── Benchmark result renderer ──────────────────────────────────
export function renderBenchmark({
  report,
  solutions,
  qu_counts,
  qu_counts_per_trial,
  rows,
  cols,
  cl_times,
  qu_times,
}: BenchmarkPayload): void {
  // Use last trial counts if multi-trial
  const counts = qu_counts_per_trial
    ? qu_counts_per_trial[qu_counts_per_trial.length - 1]
    : qu_counts;

  renderClassical({ solutions, rows, cols });
  renderQuantum(counts, rows, cols);
  renderMetrics(report, cl_times, qu_times);
}
