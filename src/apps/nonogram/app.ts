/* Nonogram Web App — bootstrap / init. */

import { state, $, must, elThresholdInput, elClPlaceholder, elQuSolPlaceholder } from './state';
import { setStatus, setBusy, updateGridSizeLabel, applyTierControls } from './ui';
import {
  initGrid,
  buildGrid,
  setMode,
  recomputeClues,
  getCurrentPuzzle,
  doClear,
  doRandomize,
  addRow,
  addCol,
  removeRow,
  removeCol,
  setOnGridEdit,
  type Puzzle,
} from './grid';
import {
  clearSolverResults,
  renderClassical,
  renderQuantum,
  renderBenchmark,
  drawEmptyHistogram,
  drawHistogram,
  renderQuantumList,
  type BenchmarkPayload,
  type ClassicalResult,
} from './solver';
import { solveLocal, LOCAL_MAX_CELLS } from './classical-solver';
import { groverOutcome, sampleCounts } from './grover-sim';
import { SiteContract, type ContractResult } from '../shared/contract-client';
import { ServiceConfig } from '../shared/service-config';

// Connection logic
let socket: NonogramSocket | null = null;

/**
 * This tab's name for its own results. The solver addresses every emit to a room
 * named by this, so one visitor's run never lands in another's window. It is kept in
 * sessionStorage because the socket's own id is reissued on every reconnect, and a
 * reload would otherwise leave a run with nowhere to be delivered.
 */
const CLIENT_KEY = 'nonogram.client';

function clientId(): string {
  let id = '';
  try {
    id = sessionStorage.getItem(CLIENT_KEY) ?? '';
    if (!id) sessionStorage.setItem(CLIENT_KEY, (id = crypto.randomUUID()));
  } catch {
    // Private windows and blocked site data both throw here. A per-load id still
    // addresses this tab's results correctly; it just does not survive a reload.
    id ||= crypto.randomUUID();
  }
  return id;
}

document.addEventListener('navbar:connect', (e) => {
  const detail = (e as CustomEvent<{ service?: string; url?: string }>).detail;
  if (detail.service !== 'nonogram' || !detail.url) return;
  // Allowlist the origin before opening a socket to it — anything on the page
  // can dispatch a CustomEvent, and this URL receives solver traffic.
  if (!ServiceConfig.isAllowedUrl(detail.url)) {
    console.warn('[nonogram] Ignoring navbar:connect URL outside the allowlist:', detail.url);
    return;
  }
  if (socket) socket.disconnect();
  // Socket.IO reads a URL path as a NAMESPACE, so the gateway prefix goes in engine.io's
  // `path`. XHR bypasses the pass fetch-wrapper, so the pass rides as ?pass= instead.
  const target = new URL(detail.url);
  const prefix = target.pathname.replace(/\/$/, '');
  const opts: NonogramSocketOptions = { path: `${prefix}/socket.io` };
  const pass = window.SitePass.token();
  if (pass) opts.query = { pass };
  socket = io(target.origin, opts);
  window.API_BASE = detail.url;
  applyTierControls();
  bindSocket(socket);
});

function bindSocket(s: NonogramSocket): void {
  // Re-announced on every connect: a reconnect issues a new socket id, and the room
  // is what carries this tab's identity across it.
  s.on('connect', () => {
    s.emit('join', { client_id: clientId() });
  });
  if (s.connected) s.emit('join', { client_id: clientId() });
  s.on('status', (p) => {
    const { msg, level } = p as { msg: string; level?: 'err' | 'ok' };
    setStatus(msg, level);
  });
  s.on('busy', (p) => {
    setBusy((p as { busy: boolean }).busy);
  });
  s.on('cl_done', (p) => {
    renderClassical(p as ClassicalResult);
  });
  s.on('qu_done', (p) => {
    const { counts, rows, cols } = p as {
      counts: Record<string, number>;
      rows: number;
      cols: number;
    };
    renderQuantum(counts, rows, cols);
  });
  s.on('bench_done', (p) => {
    renderBenchmark(p as BenchmarkPayload);
  });
  s.on('solver_error', (p) => {
    setStatus('Error: ' + (p as { message: string }).message, 'err');
    setBusy(false);
  });
}

// A live call fails in two very different ways, and they deserve opposite
// responses. If nothing answered (status 0) or the pass gate turned us away
// (401/402), the free tier IS the right answer — that's the demo-first default.
// But a backend that did answer with a contract error envelope is reporting
// something real (solver_busy, invalid_clues); quietly swapping in a browser
// result would misattribute the numbers to a solver that never ran.
function isUnreachableOrUngated(r: ContractResult): boolean {
  return r.status === 0 || r.status === 401 || r.status === 402;
}

function surfaceLiveError(r: ContractResult): void {
  const code = r.error?.code ?? 'error';
  const message = r.error?.message ?? 'The live solver rejected the request.';
  setStatus(`${code}: ${message}`, 'err');
}

// Handle a failed live benchmark: fall back to the browser solver, or surface
// the backend's own error.
function handleBenchmarkFailure(r: ContractResult): void {
  if (isUnreachableOrUngated(r)) runBenchmarkLocal(getCurrentPuzzle());
  else surfaceLiveError(r);
}

interface BenchmarkBody extends Puzzle {
  trials: number;
  client_id: string;
}

// Launch the streaming benchmark; results arrive via Socket.IO (bench_done). We only
// surface an immediate HTTP error (e.g. solver_busy / invalid_clues) from the envelope.
function streamBenchmark(body: BenchmarkBody): void {
  void SiteContract.request((window.API_BASE ?? '') + '/api/benchmark', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: 0,
  }).then((r) => {
    if (!r.ok) handleBenchmarkFailure(r);
  });
}

// Socket.IO unavailable — complete the benchmark over the synchronous REST route and
// render the result with the same renderer the live bench_done event uses.
async function runBenchmarkSync(body: BenchmarkBody): Promise<void> {
  setBusy(true);
  setStatus('Contacting the live solver…');
  let result: ContractResult | null = null;
  try {
    result = await SiteContract.request((window.API_BASE ?? '') + '/api/benchmark/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeoutMs: 0,
    });
    if (result.ok) {
      renderBenchmark(result.data as BenchmarkPayload);
      setStatus('Benchmark complete (live solver).', 'ok');
    }
  } finally {
    setBusy(false);
  }
  if (!result.ok) {
    handleBenchmarkFailure(result);
  }
}

/** What a hardware run asks for, so a simulated histogram is shaped like a real one. */
const LOCAL_SHOTS = 1024;

// Offline demo tier — solve the drawn puzzle in the browser: brute force for the
// classical half, and Grover's amplitudes for the quantum half. IBM runs stay live.
function runBenchmarkLocal(puzzle: Puzzle): void {
  const rows = puzzle.row_clues.length,
    cols = puzzle.col_clues.length;
  if (rows * cols > LOCAL_MAX_CELLS) {
    setStatus(
      `Browser solving stops at ${String(LOCAL_MAX_CELLS)} cells — remove a row or column.`,
      'err',
    );
    return;
  }
  clearSolverResults();
  showGalleryNote('');
  setBusy(true);
  // Defer one tick so the "Running…" state paints before the synchronous solve.
  setTimeout(() => {
    try {
      const t0 = performance.now();
      const { solutions } = solveLocal(puzzle.row_clues, puzzle.col_clues);
      const dt = performance.now() - t0;

      // The classical search supplies the oracle, so the amplitudes follow in closed
      // form. With no circuit built, depth and gate counts stay unknown below.
      const qubits = rows * cols;
      const outcome = groverOutcome(solutions.length, qubits);
      const quCounts = sampleCounts(solutions, qubits, LOCAL_SHOTS, outcome);

      renderBenchmark({
        report: {
          num_variables: qubits,
          classical: { solutions_found: solutions.length },
          quantum: {
            solutions_found: solutions.length,
            num_qubits: qubits,
            grover_iterations: outcome.iterations,
            top_result_probability: solutions.length ? outcome.perMarked : null,
          },
        },
        solutions,
        qu_counts: quCounts,
        rows,
        cols,
        cl_times: [dt / 1000],
        // No quantum solve time: timing a formula against a search would compare
        // nothing, and the site does not put a number next to that claim.
        qu_times: null,
      });

      const n = solutions.length;
      setStatus(
        `Solved in your browser — ${String(n)} solution${n !== 1 ? 's' : ''} in ${dt.toFixed(1)} ms. ` +
          `Grover simulated exactly; histogram sampled over ${String(LOCAL_SHOTS)} shots.`,
        'ok',
      );
    } finally {
      setBusy(false);
    }
  }, 0);
}

// Gallery: real, pre-computed quantum runs (no backend)
// Each entry is a real benchmark payload captured from the solver — the Grover
// simulator today, real IBM hardware once a hardware run is cached ("spend once,
// show forever"). Rendered through the very same renderBenchmark() a live run uses,
// so a visitor sees genuine quantum output with nothing running.

interface GalleryIndexEntry {
  slug: string;
  label: string;
  note?: string;
  source?: string;
  rows: number;
  cols: number;
}

interface GalleryPayload extends BenchmarkPayload {
  label?: string;
  source?: string;
}

let galleryNotes = new Map<string, string>();

function showGalleryNote(text: string): void {
  const el = $('gallery-note');
  if (!el) return;
  el.textContent = text;
  el.hidden = !text;
}

async function initGallery(): Promise<void> {
  const sel = document.getElementById('gallery-select');
  if (!(sel instanceof HTMLSelectElement)) return;
  let index: GalleryIndexEntry[] | null = null;
  try {
    const r = await fetch('/nonogram/gallery/index.json');
    if (r.ok) index = (await r.json()) as GalleryIndexEntry[];
  } catch {
    /* the gallery is optional */
  }
  if (!Array.isArray(index) || !index.length) return;
  galleryNotes = new Map(index.map((e) => [e.slug, e.note ?? '']));
  // Name the list by what's in it: simulator runs unless a hardware run is cached.
  // Kept short so it fits the select at every width.
  const placeholder = sel.options.item(0);
  if (placeholder) {
    placeholder.textContent = index.some((e) => e.source === 'ibm-hardware')
      ? '— quantum runs —'
      : '— simulator runs —';
  }
  for (const e of index) {
    const opt = document.createElement('option');
    opt.value = e.slug;
    opt.textContent = `${e.label} (${String(e.rows)}×${String(e.cols)})`;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', () => {
    if (sel.value) void loadGalleryEntry(sel.value);
  });
}

async function loadGalleryEntry(slug: string): Promise<void> {
  let payload: GalleryPayload | null = null;
  try {
    const r = await fetch(`/nonogram/gallery/${slug}.json`);
    if (r.ok) payload = (await r.json()) as GalleryPayload;
  } catch {
    /* handled below */
  }
  if (!payload) {
    setStatus('Gallery entry unavailable.', 'err');
    return;
  }

  // Load the gallery puzzle into the editor so the clues on screen match the result.
  const bs = payload.solutions?.[0];
  if (bs) {
    const { rows, cols } = payload;
    state.rows = rows;
    state.cols = cols;
    state.grid = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => bs[r * cols + c] === '1'),
    );
    recomputeClues();
    buildGrid();
  }

  clearSolverResults();
  renderBenchmark(payload);
  const src = payload.source === 'ibm-hardware' ? 'real IBM hardware' : 'the Grover simulator';
  setStatus(`${payload.label ?? slug} — a real run on ${src}.`, 'ok');
  showGalleryNote(galleryNotes.get(slug) ?? '');
}

// Init
function init(): void {
  initGrid();
  buildGrid();
  applyTierControls();
  elThresholdInput.disabled = true;

  // ResizeObserver redraws SVG histograms at actual pixel size
  new ResizeObserver(() => {
    if (state.histData) drawHistogram(state.histData);
    else drawEmptyHistogram();
  }).observe(must('qu-area'));

  // Threshold number input
  elThresholdInput.addEventListener('input', () => {
    const pct = parseFloat(elThresholdInput.value);
    if (isNaN(pct)) return;
    const val = Math.max(0, Math.min(1, pct / 100));
    state.userThreshold = val;
    if (state.histData) {
      state.histData.threshold = val;
      drawHistogram(state.histData);
      renderQuantumList();
    }
  });

  // Benchmark button — offline: solve the drawn puzzle in the browser; connected:
  // live Socket.IO stream, with a synchronous REST fallback.
  must('btn-bench').addEventListener('click', () => {
    if (state.busy) return;
    const puzzle = getCurrentPuzzle();
    if (!window.API_BASE) {
      runBenchmarkLocal(puzzle);
      return;
    }
    clearSolverResults();
    const trialsInput = must('trials-input') as HTMLInputElement;
    const trials = Math.max(1, parseInt(trialsInput.value, 10) || 1);
    const body: BenchmarkBody = { ...puzzle, trials, client_id: clientId() };
    if (socket?.connected) streamBenchmark(body);
    else void runBenchmarkSync(body);
  });

  // Editor action buttons
  must('btn-clear').addEventListener('click', doClear);
  must('btn-random').addEventListener('click', () => {
    void doRandomize();
  });
  const modeButtons: [string, 'draw' | 'clues'][] = [
    ['btn-mode-draw', 'draw'],
    ['btn-mode-clues', 'clues'],
  ];
  for (const [id, mode] of modeButtons) {
    must(id).addEventListener('click', () => {
      setMode(mode);
      for (const [otherId, otherMode] of modeButtons) {
        must(otherId).setAttribute('aria-pressed', String(otherMode === mode));
      }
    });
  }

  must('btn-add-row').addEventListener('click', addRow);
  must('btn-add-col').addEventListener('click', addCol);
  must('btn-remove-row').addEventListener('click', removeRow);
  must('btn-remove-col').addEventListener('click', removeCol);

  // Any edit makes the results describe a different puzzle: clear them, drop the
  // gallery selection and its note, and say so.
  setOnGridEdit(() => {
    clearSolverResults();
    elClPlaceholder.textContent = 'Solve the puzzle to see solutions.';
    elQuSolPlaceholder.textContent = 'Solve the puzzle to see solutions.';
    const sel = document.getElementById('gallery-select');
    if (sel instanceof HTMLSelectElement) sel.value = '';
    showGalleryNote('');
    drawEmptyHistogram();
    setStatus('Edited — solve again to see results.');
  });

  void initGallery();

  updateGridSizeLabel();

  requestAnimationFrame(() => {
    drawEmptyHistogram();
  });
}

// Bootstrap
init();
