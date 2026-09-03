/* =============================================================
   Nonogram Web App — bootstrap / init.
   ============================================================= */

import { state, $, must, elThresholdInput } from './state';
import { setStatus, setBusy, updateGridSizeLabel } from './ui';
import {
  initGrid,
  buildGrid,
  recomputeClues,
  getCurrentPuzzle,
  doClear,
  doRandomize,
  addRow,
  addCol,
  type Puzzle,
} from './grid';
import {
  clearSolverResults,
  renderClassical,
  renderQuantum,
  renderBenchmark,
  renderMetrics,
  drawEmptyHistogram,
  drawHistogram,
  renderQuantumList,
  type BenchmarkPayload,
  type ClassicalResult,
} from './solver';
import { solveLocal, LOCAL_MAX_CELLS } from './classical-solver';
import { SiteContract, type ContractResult } from '../shared/contract-client';
import type { ConnectWidget } from '../shared/server-connect-modal';

// ── Connection logic ───────────────────────────────────────────
let socket: NonogramSocket | null = null;
let _navWidget: ConnectWidget | null = null;

// ── Navbar connect widget ───────────────────────────────────────
document.addEventListener('navbar:connect-ready', (e) => {
  const detail = (e as CustomEvent<{ service?: string; widget?: ConnectWidget }>).detail;
  if (detail.service !== 'nonogram' || !detail.widget) return;
  _navWidget = detail.widget;
  if (socket?.connected) {
    _navWidget.setStatus('connected');
  }
});

document.addEventListener('navbar:connect', (e) => {
  const detail = (e as CustomEvent<{ service?: string; url?: string }>).detail;
  if (detail.service !== 'nonogram' || !detail.url) return;
  if (_navWidget) _navWidget.setStatus('connecting');
  if (socket) socket.disconnect();
  socket = io(detail.url);
  window.API_BASE = detail.url;
  bindSocket(socket);
});

document.addEventListener('navbar:disconnect', (e) => {
  const detail = (e as CustomEvent<{ service?: string }>).detail;
  if (detail.service !== 'nonogram') return;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  if (_navWidget) _navWidget.setStatus('disconnected');
});

function bindSocket(s: NonogramSocket): void {
  s.on('connect', () => _navWidget?.setStatus('connected'));
  s.on('disconnect', () => _navWidget?.setStatus('disconnected'));
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

// Offline demo tier — solve the drawn puzzle in the browser (classical brute
// force, no backend). Quantum + IBM runs stay on the live solver / gallery.
function runBenchmarkLocal(puzzle: Puzzle): void {
  const rows = puzzle.row_clues.length,
    cols = puzzle.col_clues.length;
  if (rows * cols > LOCAL_MAX_CELLS) {
    setStatus(
      `Too large to solve in your browser (max ${String(LOCAL_MAX_CELLS)} cells) — connect a live solver for bigger grids.`,
      'err',
    );
    return;
  }
  clearSolverResults();
  setBusy(true);
  // Defer one tick so the "Running…" state paints before the synchronous solve.
  setTimeout(() => {
    try {
      const t0 = performance.now();
      const { solutions } = solveLocal(puzzle.row_clues, puzzle.col_clues);
      const dt = performance.now() - t0;

      renderClassical({ solutions, rows, cols });

      // Quantum is a live-only feature offline; show the ghost histogram + a note.
      drawEmptyHistogram();
      const quPh = $('qu-sol-placeholder');
      if (quPh) {
        must('qu-list').appendChild(quPh);
        quPh.style.display = '';
        quPh.textContent = 'Quantum + IBM runs use the live solver — see the Gallery.';
      }

      // Real classical metrics — no handwaving.
      renderMetrics(
        {
          num_variables: rows * cols,
          classical: { solutions_found: solutions.length },
          quantum: null,
        },
        [dt / 1000],
        null,
      );

      const n = solutions.length;
      setStatus(
        `Solved in your browser — ${String(n)} solution${n !== 1 ? 's' : ''} in ${dt.toFixed(1)} ms.`,
        'ok',
      );
    } finally {
      setBusy(false);
    }
  }, 0);
}

// ── Gallery: real, pre-computed quantum runs (no backend) ────────────────────
// Each entry is a real benchmark payload captured from the solver — the Grover
// simulator today, real IBM hardware once a hardware run is cached ("spend once,
// show forever"). Rendered through the very same renderBenchmark() a live run uses,
// so a visitor sees genuine quantum output with nothing running.

interface GalleryIndexEntry {
  slug: string;
  label: string;
  rows: number;
  cols: number;
}

interface GalleryPayload extends BenchmarkPayload {
  label?: string;
  source?: string;
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
}

// ── Init ───────────────────────────────────────────────────────
function init(): void {
  initGrid();
  buildGrid();

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
    const body: BenchmarkBody = { ...puzzle, trials };
    if (socket?.connected) streamBenchmark(body);
    else void runBenchmarkSync(body);
  });

  // Editor action buttons
  must('btn-clear').addEventListener('click', doClear);
  must('btn-random').addEventListener('click', () => {
    void doRandomize();
  });
  must('btn-add-row').addEventListener('click', addRow);
  must('btn-add-col').addEventListener('click', addCol);

  void initGallery();

  // Update grid size label
  updateGridSizeLabel();

  requestAnimationFrame(() => {
    drawEmptyHistogram();
  });
}

// ── Bootstrap ──────────────────────────────────────────────────
init();
