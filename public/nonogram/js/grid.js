"use strict";
/* =============================================================
   Grid manipulation — drawing, resize.
   ============================================================= */

(function () {
const { state, $, elDrawView } = App;

const MAX_GRID = 10;

// ── Grid helpers ───────────────────────────────────────────────
function initGrid() {
  state.grid = Array.from({ length: state.rows }, () =>
    Array(state.cols).fill(false));
  recomputeClues();
}

function recomputeClues() {
  state.rowClues = computeRowClues(state.grid, state.rows, state.cols);
  state.colClues = computeColClues(state.grid, state.rows, state.cols);
}

function rle(bits) {
  const runs = [];
  let count = 0;
  for (const b of bits) {
    if (b) count++;
    else if (count) { runs.push(count); count = 0; }
  }
  if (count) runs.push(count);
  return runs.length ? runs : [0];
}

function computeRowClues(grid, rows, cols) {
  return Array.from({ length: rows }, (_, r) => rle(grid[r]));
}

function computeColClues(grid, rows, cols) {
  return Array.from({ length: cols }, (_, c) =>
    rle(Array.from({ length: rows }, (_, r) => grid[r][c])));
}

// ── Clue slot helpers ──────────────────────────────────────────
function getMaxRowLen() {
  if (!state.rowClues.length) return 1;
  return Math.max(1, ...state.rowClues.map(c => c.filter(v => v > 0).length));
}
function getMaxColLen() {
  if (!state.colClues.length) return 1;
  return Math.max(1, ...state.colClues.map(c => c.filter(v => v > 0).length));
}

function makeRowClueContent(clue, maxLen) {
  const nonzero = clue.filter(v => v > 0);
  const div = document.createElement("div");
  div.className = "row-clue-slots";
  for (let i = 0; i < maxLen; i++) {
    const slot = document.createElement("span");
    const valIdx = i - (maxLen - nonzero.length);
    slot.className = valIdx >= 0 ? "clue-slot" : "clue-slot empty";
    if (valIdx >= 0) slot.textContent = nonzero[valIdx];
    div.appendChild(slot);
  }
  return div;
}

function makeColClueContent(clue, maxLen) {
  const nonzero = clue.filter(v => v > 0);
  const div = document.createElement("div");
  div.className = "col-clue-slots";
  for (let i = 0; i < maxLen; i++) {
    const slot = document.createElement("span");
    const valIdx = i - (maxLen - nonzero.length);
    slot.className = valIdx >= 0 ? "clue-slot" : "clue-slot empty";
    if (valIdx >= 0) slot.textContent = nonzero[valIdx];
    div.appendChild(slot);
  }
  return div;
}

// ── Grid build (Draw mode) ─────────────────────────────────────
function buildGrid() {
  const rows = state.rows, cols = state.cols;
  const maxRowLen = getMaxRowLen();
  const maxColLen = getMaxColLen();

  const tbl = document.createElement("table");
  tbl.className = "nonogram-table";

  // ── Header row: corner + col clues ──
  const hdr = tbl.insertRow();

  const corner = hdr.insertCell();
  corner.className = "corner-cell";

  // Column clue cells
  for (let c = 0; c < cols; c++) {
    const td = hdr.insertCell();
    td.className = "col-clue";
    td.id = `cclue-${c}`;
    td.appendChild(makeColClueContent(state.colClues[c], maxColLen));
  }

  // ── Data rows ──
  for (let r = 0; r < rows; r++) {
    const tr = tbl.insertRow();

    const rClue = tr.insertCell();
    rClue.className = "row-clue";
    rClue.id = `rclue-${r}`;
    rClue.appendChild(makeRowClueContent(state.rowClues[r], maxRowLen));

    for (let c = 0; c < cols; c++) {
      const td = tr.insertCell();
      td.className = "cell" + (state.grid[r][c] ? " filled" : "");
      td.dataset.r = r;
      td.dataset.c = c;
    }
  }

  tbl.addEventListener("mousedown", onGridMouseDown);
  tbl.addEventListener("mouseover", onGridMouseOver);
  document.addEventListener("mouseup", () => { _dragFill = null; });

  elDrawView.dataset.maxRowLen = maxRowLen;
  elDrawView.dataset.maxColLen = maxColLen;
  elDrawView.innerHTML = "";
  elDrawView.appendChild(tbl);

  if (App.updateGridSizeLabel) App.updateGridSizeLabel();
}

// ── Cell interaction ────────────────────────────────────────────
let _dragFill = null;

function onGridMouseDown(e) {
  const td = e.target.closest("td.cell");
  if (!td) return;
  e.preventDefault();
  const r = +td.dataset.r, c = +td.dataset.c;
  _dragFill = !state.grid[r][c];
  toggleCell(r, c, _dragFill);
}

function onGridMouseOver(e) {
  if (_dragFill === null) return;
  const td = e.target.closest("td.cell");
  if (!td) return;
  const r = +td.dataset.r, c = +td.dataset.c;
  if (state.grid[r][c] !== _dragFill) toggleCell(r, c, _dragFill);
}

function toggleCell(r, c, fill) {
  state.grid[r][c] = fill;
  const td = document.querySelector(`td[data-r="${r}"][data-c="${c}"]`);
  if (td) td.className = "cell" + (fill ? " filled" : "");
  recomputeClues();
  updateClueCells();
}

function updateClueCells() {
  const newMaxRowLen = getMaxRowLen();
  const newMaxColLen = getMaxColLen();
  const prevMaxRowLen = parseInt(elDrawView.dataset.maxRowLen || "0");
  const prevMaxColLen = parseInt(elDrawView.dataset.maxColLen || "0");

  if (newMaxRowLen !== prevMaxRowLen || newMaxColLen !== prevMaxColLen) {
    _dragFill = null;
    buildGrid();
    return;
  }

  for (let r = 0; r < state.rows; r++) {
    const el = $(`rclue-${r}`);
    if (!el) continue;
    const slots = el.querySelectorAll(".clue-slot");
    const nonzero = state.rowClues[r].filter(v => v > 0);
    const pad = newMaxRowLen - nonzero.length;
    slots.forEach((slot, i) => {
      if (i < pad) { slot.className = "clue-slot empty"; slot.textContent = ""; }
      else         { slot.className = "clue-slot";       slot.textContent = nonzero[i - pad]; }
    });
  }
  for (let c = 0; c < state.cols; c++) {
    const el = $(`cclue-${c}`);
    if (!el) continue;
    const slots = el.querySelectorAll(".clue-slot");
    const nonzero = state.colClues[c].filter(v => v > 0);
    const pad = newMaxColLen - nonzero.length;
    slots.forEach((slot, i) => {
      if (i < pad) { slot.className = "clue-slot empty"; slot.textContent = ""; }
      else         { slot.className = "clue-slot";       slot.textContent = nonzero[i - pad]; }
    });
  }
}

// ── Dynamic grid sizing ────────────────────────────────────────
function addRow() {
  if (state.rows >= MAX_GRID) return;
  state.rows++;
  state.grid.push(Array(state.cols).fill(false));
  recomputeClues();
  buildGrid();
  syncGridToServer();
}

function addCol() {
  if (state.cols >= MAX_GRID) return;
  state.cols++;
  for (const row of state.grid) row.push(false);
  recomputeClues();
  buildGrid();
  syncGridToServer();
}

function syncGridToServer() {
  if (!window.API_BASE) return;
  fetch(API_BASE + "/api/grid", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows: state.rows, cols: state.cols, grid: state.grid }),
  });
}

// ── Puzzle I/O ──────────────────────────────────────────────────
function getCurrentPuzzle() {
  recomputeClues();
  return {
    row_clues: state.rowClues,
    col_clues: state.colClues,
  };
}

function doClear() {
  state.grid = Array.from({ length: state.rows }, () =>
    Array(state.cols).fill(false));
  recomputeClues();
  buildGrid();
  syncGridToServer();
  App.setStatus("Grid cleared.");
}

async function doRandomize() {
  if (!window.API_BASE) return;
  const rows = state.rows, cols = state.cols;
  try {
    const res = await fetch(API_BASE + "/api/randomize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows, cols }),
    });
    if (!res.ok) { App.setStatus("Randomize failed.", "err"); return; }
    const data = await res.json();
    state.rows = data.rows; state.cols = data.cols; state.grid = data.grid;
    recomputeClues();
    buildGrid();
    syncGridToServer();
    const filled = state.grid.flat().filter(Boolean).length;
    App.setStatus(`Randomized ${rows}\u00d7${cols} puzzle (${filled} filled).`);
  } catch (err) {
    App.setStatus("Randomize error: " + err.message, "err");
  }
}

function getBestSolSize(rows, cols) {
  const cells = rows * cols;
  if (cells <= 6)  return "lg";
  if (cells <= 16) return "md";
  return "sm";
}

// Export to namespace
Object.assign(App, {
  initGrid, recomputeClues, buildGrid,
  syncGridToServer, getCurrentPuzzle,
  doClear, doRandomize,
  getBestSolSize,
  addRow, addCol,
});
})();
