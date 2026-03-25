"use strict";
/* =============================================================
   State & DOM references — shared across all modules.
   ============================================================= */

window.App = window.App || {};

// ── State ──────────────────────────────────────────────────────
const state = {
  rows: 3, cols: 3,
  grid: [],            // 2-D bool array [row][col]
  rowClues: [],        // list of int[] (derived from grid)
  colClues: [],
  busy: false,
  histData: null,      // {entries, threshold, rows, cols}
  userThreshold: null,  // user-set threshold value (preserved across runs)
};

// ── Helpers ────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── DOM references ─────────────────────────────────────────────
const elDrawView      = $("draw-view");
const elHistSvg       = $("qu-histogram");
const elQuPlaceholder = $("qu-placeholder");
const elClPlaceholder = $("cl-placeholder");
const elQuArea        = $("qu-area");
const elQuList        = $("qu-list");
const elBtnBench      = $("btn-bench");
const elThresholdInput = $("threshold-input");

// ── SVG icon constants ──────────────────────────────────────────
const X_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><line x1="2" y1="2" x2="8" y2="8"/><line x1="8" y1="2" x2="2" y2="8"/></svg>`;

// Export to namespace
Object.assign(App, {
  state, $,
  elDrawView, elHistSvg,
  elQuPlaceholder, elClPlaceholder, elQuArea, elQuList,
  elBtnBench, elThresholdInput,
  X_SVG,
});
