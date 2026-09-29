/* Nonogram Web App — bootstrap / init. */

import {
  state,
  must,
  clientId,
  elClPlaceholder,
  elQuSolPlaceholder,
} from './state';
import {
  setStatus,
  setBusy,
  updateGridSizeLabel,
  applyTierControls,
  applyHardwareControl,
  isUnavailable,
  runWhere,
  setRunWhere,
} from './ui';
import {
  initGrid,
  buildGrid,
  setMode,
  recomputeClues,
  getCurrentPuzzle,
  doClear,
  doReset,
  doRandomize,
  setOnGridEdit,
  type Puzzle,
} from './grid';
import {
  clearMetrics,
  clearSolverResults,
  renderClassical,
  renderQuantum,
  renderBenchmark,
  setRunMeta,
  drawEmptyHistogram,
  drawHistogram,
  type BenchmarkPayload,
  type ClassicalResult,
} from './solver';
import { solveLocal, LOCAL_MAX_CELLS } from './classical-solver';
import { initCodePane, renderCodePane } from './code-pane';
import { groverOutcome, sampleCounts, shotCount } from './grover-sim';
import {
  pendingJob,
  refreshStatus,
  watchSession,
  submitJob,
  waitForJob,
  withinHardwareLimit,
  type CollectedJob,
  type HardwareJob,
} from './hardware';
import { track } from '../../telemetry';
import { SiteContract, type ContractResult } from '../shared/contract-client';
import { ServiceConfig } from '../shared/service-config';

// Connection logic
let socket: NonogramSocket | null = null;

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
  // What this visitor may spend is the gateway's to say, and it changes the button.
  void refreshStatus().then(() => {
    applyHardwareControl();
  });
});

function bindSocket(s: NonogramSocket): void {
  // Re-announced on every connect: a reconnect issues a new socket id, and the room
  // is what carries this tab's identity across it.
  s.on('connect', () => {
    s.emit('join', { client_id: clientId() });
  });
  if (s.connected) s.emit('join', { client_id: clientId() });
  s.on('status', (p) => {
    const { msg, level } = p as { msg: string; level?: 'err' };
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
  setStatus('Contacting the live solver.');
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

// Offline demo tier — solve the drawn puzzle in the browser: the backtracking search
// for the classical half, and Grover's amplitudes for the quantum half. IBM runs stay live.
function runBenchmarkLocal(puzzle: Puzzle): void {
  const rows = puzzle.row_clues.length,
    cols = puzzle.col_clues.length;
  if (rows * cols > LOCAL_MAX_CELLS) {
    setStatus(
      `Browser solving stops at ${String(LOCAL_MAX_CELLS)} cells — remove a row or column.`,
      'err',
    );
    track({
      app: 'nonogram',
      event: 'run.done',
      tier: 'browser',
      outcome: 'capped',
      a: rows,
      b: cols,
    });
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

      // The classical search supplies the oracle, so the amplitudes follow in closed
      // form. With no circuit built, depth and gate counts stay unknown below.
      const qubits = rows * cols;
      const q0 = performance.now();
      const outcome = groverOutcome(solutions.length, qubits);
      const quCounts = sampleCounts(solutions, qubits, LOCAL_SHOTS, outcome);
      const qdt = performance.now() - q0;

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
        qu_times: [qdt / 1000],
      });

      // Each figure sits on the section it describes, so nothing needs restating in
      // a status line underneath.
      setRunMeta({
        classical: `${dt.toFixed(1)} ms`,
        // The time measures the draw: the amplitudes come from a closed form, so what
        // takes any time at all is sampling them into counts.
        quantum:
          `noiseless, ${String(outcome.iterations)} iteration${outcome.iterations === 1 ? '' : 's'} · ` +
          `${String(LOCAL_SHOTS)} shots drawn in ${qdt.toFixed(1)} ms`,
        histogram: `${String(LOCAL_SHOTS)} shots`,
        histogramHover: `Sampled from the exact distribution over ${String(LOCAL_SHOTS)} shots, the count a hardware run asks for.`,
      });

      const n = solutions.length;
      track({
        app: 'nonogram',
        event: 'run.done',
        tier: 'browser',
        outcome: n > 0 ? 'ok' : 'empty',
        variant: state.mode,
        value: dt,
        a: rows,
        b: cols,
        n,
      });
      // The rules above carry the numbers and the panels carry the answers, so a
      // line here would only repeat them. Failures still speak for themselves.
      setStatus('');
    } finally {
      setBusy(false);
    }
  }, 0);
}

// IBM hardware tier
// The run is two calls with a wait between them, so the page owns the waiting: the
// solver is free the moment IBM has the job, and a reload rejoins the same run.

/**
 * Shots behind a histogram, when that is what the counts are.
 *
 * A live or hardware run reports integer counts; a captured gallery run stores the
 * distribution those counts became, summing to 1. Calling that "1 shots" would be a
 * measurement nobody took, so it goes unsaid.
 */
function shotsLabel(counts: Record<string, number> | null | undefined): string {
  const shots = shotCount(counts ?? {});
  return shots === null ? '' : `${String(shots)} shots`;
}

/** A captured run's classical time, in the milliseconds the rules show. */
function firstMs(times: number[] | null | undefined): string {
  const first = times?.[0];
  return typeof first === 'number' ? `${(first * 1000).toFixed(1)} ms` : '';
}

/** Shots for a hardware run. Halved past 4 cells: the circuit is ~6x deeper there and
 *  every shot on it costs more of a 10-minute monthly allowance. */
function hardwareShots(rows: number, cols: number): number {
  return rows * cols > 4 ? 512 : 1024;
}

let stopWaiting: (() => void) | null = null;

function renderHardware(job: HardwareJob, collected: CollectedJob): void {
  const { rows, cols } = job;
  const counts = collected.counts ?? {};
  renderQuantum(counts, rows, cols);

  const shots = Object.values(counts).reduce((a, b) => a + b, 0);
  const top = Object.values(counts).sort((a, b) => b - a)[0] ?? 0;
  const chance = 1 / 2 ** (rows * cols);
  const measured = shots > 0 ? top / shots : 0;

  // Said plainly either way. A deep circuit on a NISQ device usually returns the
  // uniform distribution, which is a result about the device and worth reporting.
  const verdict =
    measured > chance * 2
      ? `top state ${(measured * 100).toFixed(1)}% against ${(chance * 100).toFixed(2)}% by chance`
      : `flat — ${(measured * 100).toFixed(1)}% on the top state against ${(chance * 100).toFixed(2)}% by chance, which is what decoherence at this depth looks like`;

  const device = collected.backend ?? job.backend ?? 'IBM';
  setRunMeta({
    quantum: device,
    histogram: `${String(shots)} shots`,
    histogramHover: job.transpiled_depth
      ? `${device}, ${String(shots)} shots, transpiled depth ${String(job.transpiled_depth)}.`
      : `${device}, ${String(shots)} shots.`,
  });
  setStatus(`${device}: ${verdict}.`);
  track({
    app: 'nonogram',
    event: 'run.done',
    tier: 'hardware',
    outcome: shots > 0 ? 'ok' : 'empty',
    detail: collected.backend ?? undefined,
    value: measured,
    a: rows,
    b: cols,
    n: job.transpiled_depth,
  });
}

function watch(job: HardwareJob): void {
  stopWaiting?.();
  setBusy(true);
  stopWaiting = waitForJob(job, {
    onWaiting: (status, elapsed) => {
      const mins = Math.floor(elapsed / 60000);
      const depth = job.transpiled_depth ? `, depth ${String(job.transpiled_depth)}` : '';
      setStatus(
        `${job.backend ?? 'IBM'}: ${status.toLowerCase()}${depth} — ${String(mins)} min waiting. The queue is IBM's, not ours.`,
      );
    },
    onDone: (collected) => {
      setBusy(false);
      if (collected.status === 'DONE') renderHardware(job, collected);
      else setStatus(`The job ended ${collected.status.toLowerCase()} at IBM.`, 'err');
    },
    onGaveUp: (reason) => {
      setBusy(false);
      setStatus(reason, 'err');
    },
  });
}

async function runOnHardware(): Promise<void> {
  const puzzle = getCurrentPuzzle();
  const rows = puzzle.row_clues.length,
    cols = puzzle.col_clues.length;
  if (!withinHardwareLimit(rows, cols)) return;

  clearSolverResults();
  setBusy(true);
  setStatus('Submitting to IBM.');
  const job = await submitJob(
    puzzle.row_clues,
    puzzle.col_clues,
    rows,
    cols,
    hardwareShots(rows, cols),
  );
  if (!job) {
    setBusy(false);
    return;
  }
  watch({ ...job, rows, cols });
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
  /** The device a captured hardware run was measured on. */
  hardware?: string | null;
}


/** The board the page opens on: the largest the in-page simulator handles comfortably. */
const OPENING_RUN = 'plus-3x3';

/**
 * Whether anyone has touched the app yet.
 *
 * The opening run arrives over the network, so it can land after a reader has already
 * started drawing. It fills the grid and clears the results, which would take their
 * work with it, so it gives way to anything done in the meantime.
 */
let untouched = true;

function watchForUse(): void {
  for (const event of ['pointerdown', 'keydown'] as const) {
    document.addEventListener(
      event,
      () => {
        untouched = false;
      },
      { capture: true, once: true },
    );
  }
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

  // Open on a run rather than on an empty comparison: the page is about what the two
  // searches cost, and a reader should see that before drawing anything themselves.
  const opening = index.find((e) => e.slug === OPENING_RUN) ?? index[0];
  if (!untouched) return;
  sel.value = opening.slug;
  await loadGalleryEntry(opening.slug);
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
  const shots = shotsLabel(payload.qu_counts);
  setRunMeta({
    classical: firstMs(payload.cl_times),
    quantum: payload.source === 'ibm-hardware' ? (payload.hardware ?? 'IBM hardware') : 'simulated',
    histogram: shots,
    histogramHover: `A captured run on ${src}${shots ? `, over ${shots}` : ''}.`,
  });
}

// Init
function init(): void {
  initGrid();
  buildGrid();
  applyTierControls();

  // ResizeObserver redraws SVG histograms at actual pixel size
  new ResizeObserver(() => {
    if (state.histData) drawHistogram(state.histData);
    else drawEmptyHistogram();
  }).observe(must('qu-area'));

  // Threshold number input

  // Benchmark button — offline: solve the drawn puzzle in the browser; connected:
  // live Socket.IO stream, with a synchronous REST fallback.
  const benchButton = must('btn-bench') as HTMLButtonElement;
  for (const [id, target] of [
    ['btn-where-local', 'local'],
    ['btn-where-hw', 'hardware'],
  ] as const) {
    must(id).addEventListener('click', () => {
      setRunWhere(target);
    });
  }

  benchButton.addEventListener('click', () => {
    if (state.busy) return;
    // Unavailable rather than disabled, so the click still arrives and is ignored.
    if (runWhere() === 'hardware') {
      if (!isUnavailable(benchButton)) void runOnHardware();
      return;
    }
    const puzzle = getCurrentPuzzle();
    if (!window.API_BASE) {
      runBenchmarkLocal(puzzle);
      return;
    }
    clearSolverResults();
    // One run: every figure the page reports is exact, so repeating a run only
    // averages the clock.
    const body: BenchmarkBody = { ...puzzle, trials: 1, client_id: clientId() };
    if (socket?.connected) streamBenchmark(body);
    else void runBenchmarkSync(body);
  });

  // Editor action buttons
  must('btn-clear').addEventListener('click', doClear);
  must('btn-reset').addEventListener('click', doReset);
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

  watchSession(() => {
    applyHardwareControl();
  });

  // Asked on load as well as on connect: whether someone is signed in is the
  // gateway's to answer, and holds whether or not an app is awake.
  void refreshStatus().then(() => {
    applyHardwareControl();
  });

  // A reload during an IBM queue rejoins the same job rather than losing it.
  const waiting = pendingJob();
  if (waiting) watch(waiting);

  // The circuit describes the board rather than a run, so it follows every edit
  // instead of waiting for a solve.
  const refreshCode = (): void => {
    const puzzle = getCurrentPuzzle();
    renderCodePane(puzzle.row_clues, puzzle.col_clues);
  };
  initCodePane(refreshCode);

  // Any edit makes the results describe a different puzzle: clear them, drop the
  // gallery selection and its note, and say so.
  setOnGridEdit(() => {
    clearSolverResults();
    refreshCode();
    elClPlaceholder.textContent = 'Solve the puzzle to see solutions.';
    elQuSolPlaceholder.textContent = 'Solve the puzzle to see solutions.';
    const sel = document.getElementById('gallery-select');
    if (sel instanceof HTMLSelectElement) sel.value = '';
    drawEmptyHistogram();
  });

  watchForUse();
  void initGallery();

  updateGridSizeLabel();

  requestAnimationFrame(() => {
    drawEmptyHistogram();
    // The comparison's own frame, before there is anything to compare.
    clearMetrics();
    refreshCode();
  });
}

// Bootstrap
init();
