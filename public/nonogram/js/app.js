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

  // Benchmark button
  $("btn-bench").addEventListener("click", () => {
    if (state.busy) return;
    App.clearSolverResults();
    const puzzle = App.getCurrentPuzzle();
    const trials = Math.max(1, parseInt($("trials-input").value, 10) || 1);
    fetch(API_BASE + "/api/benchmark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...puzzle, trials }),
    });
  });

  // Editor action buttons
  $("btn-clear").addEventListener("click", App.doClear);
  $("btn-random").addEventListener("click", App.doRandomize);
  $("btn-add-row").addEventListener("click", App.addRow);
  $("btn-add-col").addEventListener("click", App.addCol);

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
