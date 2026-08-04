"use strict";
/* =============================================================
   Nonogram Web App — bootstrap / init
   Loads after: state.js, grid.js, solver.js
   ============================================================= */

(function () {
const { state, $ } = App;

// ── Status and busy helpers ────────────────────────────────────
function setStatus(msg, level) {
  const el = $("status-line");
  if (!el) return;
  el.textContent = msg;
  el.className = "status-line" + (level === "err" ? " status-err" : level === "ok" ? " status-ok" : "");
}

function setBusy(busy) {
  state.busy = busy;
  const btn = $("btn-bench");
  btn.disabled = busy;
  if (busy) {
    btn.textContent = "Running\u2026";
  } else {
    btn.textContent = "\u25b6 Run on Simulator";
  }
  $("btn-clear").disabled = busy;
  $("btn-random").disabled = busy;
  $("btn-add-row").disabled = busy;
  $("btn-add-col").disabled = busy;
}

App.setStatus = setStatus;
App.setBusy = setBusy;

// ── Connection logic ───────────────────────────────────────────
let socket = null;
let _navWidget = null;

// ── Navbar connect widget ───────────────────────────────────────
document.addEventListener("navbar:connect-ready", e => {
  if (e.detail.service !== "nonogram") return;
  _navWidget = e.detail.widget;
  if (socket && socket.connected) {
    _navWidget.setStatus("connected");
  }
});

document.addEventListener("navbar:connect", e => {
  if (e.detail.service !== "nonogram") return;
  if (_navWidget) _navWidget.setStatus("connecting");
  if (socket) socket.disconnect();
  socket = io(e.detail.url);
  window.API_BASE = e.detail.url;
  bindSocket(socket);
});

document.addEventListener("navbar:disconnect", e => {
  if (e.detail.service !== "nonogram") return;
  if (socket) { socket.disconnect(); socket = null; }
  if (_navWidget) _navWidget.setStatus("disconnected");
});

function bindSocket(s) {
  s.on("connect",      () => { if (_navWidget) _navWidget.setStatus("connected"); });
  s.on("disconnect",   () => { if (_navWidget) _navWidget.setStatus("disconnected"); });
  s.on("status",       ({ msg, level }) => setStatus(msg, level));
  s.on("busy",         ({ busy }) => setBusy(busy));
  s.on("cl_done",      App.renderClassical);
  s.on("qu_done",      ({ counts, rows, cols }) => App.renderQuantum(counts, rows, cols));
  s.on("bench_done",   App.renderBenchmark);
  s.on("solver_error", ({ message }) => {
    setStatus("Error: " + message, "err");
    setBusy(false);
  });
}

// A live call fails in two very different ways, and they deserve opposite
// responses. If nothing answered (status 0) or the pass gate turned us away
// (401/402), the free tier IS the right answer — that's the demo-first default.
// But a backend that did answer with a contract error envelope is reporting
// something real (solver_busy, invalid_clues); quietly swapping in a browser
// result would misattribute the numbers to a solver that never ran.
function isUnreachableOrUngated(r) {
  return r.status === 0 || r.status === 401 || r.status === 402;
}

function surfaceLiveError(r) {
  const code = (r.error && r.error.code) || "error";
  const message = (r.error && r.error.message) || "The live solver rejected the request.";
  App.setStatus(`${code}: ${message}`, "err");
}

// Handle a failed live benchmark: fall back to the browser solver, or surface
// the backend's own error.
function handleBenchmarkFailure(r) {
  if (isUnreachableOrUngated(r)) runBenchmarkLocal(App.getCurrentPuzzle());
  else surfaceLiveError(r);
}

// Launch the streaming benchmark; results arrive via Socket.IO (bench_done). We only
// surface an immediate HTTP error (e.g. solver_busy / invalid_clues) from the envelope.
function streamBenchmark(body) {
  const init = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  if (window.SiteContract && window.SiteContract.request) {
    window.SiteContract.request(window.API_BASE + "/api/benchmark", { ...init, timeoutMs: 0 }).then(r => {
      if (!r.ok) handleBenchmarkFailure(r);
    });
  } else {
    fetch(window.API_BASE + "/api/benchmark", init);
  }
}

// Socket.IO unavailable — complete the benchmark over the synchronous REST route and
// render the result with the same renderer the live bench_done event uses.
async function runBenchmarkSync(body) {
  if (!(window.SiteContract && window.SiteContract.request)) {
    runBenchmarkLocal(App.getCurrentPuzzle());
    return;
  }
  App.setBusy(true);
  App.setStatus("Contacting the live solver…");
  let result = null;
  try {
    result = await window.SiteContract.request(window.API_BASE + "/api/benchmark/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      timeoutMs: 0,
    });
    if (result.ok) {
      App.renderBenchmark(result.data);
      App.setStatus("Benchmark complete (live solver).", "ok");
    }
  } finally {
    App.setBusy(false);
  }
  if (!result || !result.ok) {
    handleBenchmarkFailure(result || { status: 0 });
  }
}

// Offline demo tier — solve the drawn puzzle in the browser (classical brute
// force, no backend). Quantum + IBM runs stay on the live solver / gallery.
function runBenchmarkLocal(puzzle) {
  const rows = puzzle.row_clues.length, cols = puzzle.col_clues.length;
  if (rows * cols > App.LOCAL_MAX_CELLS) {
    App.setStatus(`Too large to solve in your browser (max ${App.LOCAL_MAX_CELLS} cells) — connect a live solver for bigger grids.`, "err");
    return;
  }
  App.clearSolverResults();
  App.setBusy(true);
  // Defer one tick so the "Running…" state paints before the synchronous solve.
  setTimeout(() => {
    try {
      const t0 = performance.now();
      const { solutions } = App.solveLocal(puzzle.row_clues, puzzle.col_clues);
      const dt = performance.now() - t0;

      App.renderClassical({ solutions, rows, cols });

      // Quantum is a live-only feature offline; show the ghost histogram + a note.
      App.drawEmptyHistogram();
      const quPh = $("qu-sol-placeholder");
      if (quPh) {
        $("qu-list").appendChild(quPh);
        quPh.style.display = "";
        quPh.textContent = "Quantum + IBM runs use the live solver — see the Gallery.";
      }

      // Real classical metrics — no handwaving.
      App.renderMetrics(
        { num_variables: rows * cols, classical: { solutions_found: solutions.length }, quantum: null },
        [dt / 1000],
        null,
      );

      const n = solutions.length;
      App.setStatus(`Solved in your browser — ${n} solution${n !== 1 ? "s" : ""} in ${dt.toFixed(1)} ms.`, "ok");
    } finally {
      App.setBusy(false);
    }
  }, 0);
}

// ── Gallery: real, pre-computed quantum runs (no backend) ────────────────────
// Each entry is a real benchmark payload captured from the solver — the Grover
// simulator today, real IBM hardware once a hardware run is cached ("spend once,
// show forever"). Rendered through the very same renderBenchmark() a live run uses,
// so a visitor sees genuine quantum output with nothing running.
async function initGallery() {
  const sel = $("gallery-select");
  if (!sel) return;
  let index = null;
  try {
    const r = await fetch("/nonogram/gallery/index.json");
    if (r.ok) index = await r.json();
  } catch (_) { /* the gallery is optional */ }
  if (!Array.isArray(index) || !index.length) return;
  for (const e of index) {
    const opt = document.createElement("option");
    opt.value = e.slug;
    opt.textContent = `${e.label} (${e.rows}×${e.cols})`;
    sel.appendChild(opt);
  }
  sel.addEventListener("change", () => { if (sel.value) loadGalleryEntry(sel.value); });
}

async function loadGalleryEntry(slug) {
  let payload = null;
  try {
    const r = await fetch(`/nonogram/gallery/${slug}.json`);
    if (r.ok) payload = await r.json();
  } catch (_) { /* handled below */ }
  if (!payload) { App.setStatus("Gallery entry unavailable.", "err"); return; }

  // Load the gallery puzzle into the editor so the clues on screen match the result.
  const bs = (payload.solutions || [])[0];
  if (bs) {
    state.rows = payload.rows;
    state.cols = payload.cols;
    state.grid = Array.from({ length: payload.rows }, (_, r) =>
      Array.from({ length: payload.cols }, (_, c) => bs[r * payload.cols + c] === "1"));
    App.recomputeClues();
    App.buildGrid();
  }

  App.clearSolverResults();
  App.renderBenchmark(payload);
  const src = payload.source === "ibm-hardware" ? "real IBM hardware" : "the Grover simulator";
  App.setStatus(`${payload.label} — a real run on ${src}.`, "ok");
}

// ── Init ───────────────────────────────────────────────────────
function init() {
  App.initGrid();
  App.buildGrid();

  // ResizeObserver redraws SVG histograms at actual pixel size
  new ResizeObserver(() => {
    if (state.histData) App.drawHistogram(state.histData);
    else                App.drawEmptyHistogram();
  }).observe($("qu-area"));

  // Threshold number input
  $("threshold-input").addEventListener("input", () => {
    const pct = parseFloat($("threshold-input").value);
    if (isNaN(pct)) return;
    const val = Math.max(0, Math.min(1, pct / 100));
    state.userThreshold = val;
    if (state.histData) {
      state.histData.threshold = val;
      App.drawHistogram(state.histData);
      App.renderQuantumList();
    }
  });

  // Benchmark button — offline: solve the drawn puzzle in the browser; connected:
  // live Socket.IO stream, with a synchronous REST fallback.
  $("btn-bench").addEventListener("click", () => {
    if (state.busy) return;
    const puzzle = App.getCurrentPuzzle();
    if (!window.API_BASE) { runBenchmarkLocal(puzzle); return; }
    App.clearSolverResults();
    const trials = Math.max(1, parseInt($("trials-input").value, 10) || 1);
    const body = { ...puzzle, trials };
    if (socket && socket.connected) streamBenchmark(body);
    else runBenchmarkSync(body);
  });

  // Editor action buttons
  $("btn-clear").addEventListener("click", App.doClear);
  $("btn-random").addEventListener("click", App.doRandomize);
  $("btn-add-row").addEventListener("click", App.addRow);
  $("btn-add-col").addEventListener("click", App.addCol);

  initGallery();

  // Update grid size label
  updateGridSizeLabel();

  requestAnimationFrame(() => App.drawEmptyHistogram());
}

function updateGridSizeLabel() {
  $("grid-size-label").textContent = `${state.rows} \u00d7 ${state.cols}`;
}
App.updateGridSizeLabel = updateGridSizeLabel;

// ── Bootstrap ──────────────────────────────────────────────────
init();
})();
