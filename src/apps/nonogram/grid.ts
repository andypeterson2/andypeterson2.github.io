/* =============================================================
   Grid manipulation — drawing, resize.
   ============================================================= */

import { state, $, elDrawView } from './state';
import { setStatus, updateGridSizeLabel } from './ui';

const MAX_GRID = 10;
const MIN_GRID = 2;

// Any change to the puzzle makes the results on screen describe a different grid.
// app.ts registers what "edited" means (clear results, reset the gallery) so this
// module doesn't import solver/app code (audit M22).
let onEdit: () => void = () => undefined;
export function setOnGridEdit(fn: () => void): void {
  onEdit = fn;
}

// ── Grid helpers ───────────────────────────────────────────────
export function initGrid(): void {
  state.grid = Array.from({ length: state.rows }, () => Array<boolean>(state.cols).fill(false));
  recomputeClues();
}

export function recomputeClues(): void {
  state.rowClues = computeRowClues(state.grid, state.rows);
  state.colClues = computeColClues(state.grid, state.rows, state.cols);
}

function rle(bits: boolean[]): number[] {
  const runs: number[] = [];
  let count = 0;
  for (const b of bits) {
    if (b) count++;
    else if (count) {
      runs.push(count);
      count = 0;
    }
  }
  if (count) runs.push(count);
  return runs.length ? runs : [0];
}

function computeRowClues(grid: boolean[][], rows: number): number[][] {
  return Array.from({ length: rows }, (_, r) => rle(grid[r] ?? []));
}

function computeColClues(grid: boolean[][], rows: number, cols: number): number[][] {
  return Array.from({ length: cols }, (_, c) =>
    rle(Array.from({ length: rows }, (_, r) => grid[r]?.[c] ?? false)),
  );
}

// ── Clue slot helpers ──────────────────────────────────────────
function getMaxRowLen(): number {
  if (!state.rowClues.length) return 1;
  return Math.max(1, ...state.rowClues.map((c) => c.filter((v) => v > 0).length));
}
function getMaxColLen(): number {
  if (!state.colClues.length) return 1;
  return Math.max(1, ...state.colClues.map((c) => c.filter((v) => v > 0).length));
}

function makeClueContent(clue: number[], maxLen: number, className: string): HTMLDivElement {
  const nonzero = clue.filter((v) => v > 0);
  const div = document.createElement('div');
  div.className = className;
  for (let i = 0; i < maxLen; i++) {
    const slot = document.createElement('span');
    const valIdx = i - (maxLen - nonzero.length);
    slot.className = valIdx >= 0 ? 'clue-slot' : 'clue-slot empty';
    if (valIdx >= 0) slot.textContent = String(nonzero[valIdx]);
    div.appendChild(slot);
  }
  return div;
}

// ── Grid build (Draw mode) ─────────────────────────────────────
export function buildGrid(): void {
  const rows = state.rows,
    cols = state.cols;
  const maxRowLen = getMaxRowLen();
  const maxColLen = getMaxColLen();

  const tbl = document.createElement('table');
  tbl.className = 'nonogram-table';

  // ── Header row: corner + col clues ──
  const hdr = tbl.insertRow();

  const corner = hdr.insertCell();
  corner.className = 'corner-cell';

  // Column clue cells
  for (let c = 0; c < cols; c++) {
    const td = hdr.insertCell();
    td.className = 'col-clue';
    td.id = `cclue-${String(c)}`;
    td.appendChild(makeClueContent(state.colClues[c] ?? [], maxColLen, 'col-clue-slots'));
  }

  // ── Data rows ──
  for (let r = 0; r < rows; r++) {
    const tr = tbl.insertRow();

    const rClue = tr.insertCell();
    rClue.className = 'row-clue';
    rClue.id = `rclue-${String(r)}`;
    rClue.appendChild(makeClueContent(state.rowClues[r] ?? [], maxRowLen, 'row-clue-slots'));

    for (let c = 0; c < cols; c++) {
      const td = tr.insertCell();
      td.className = 'cell' + (state.grid[r]?.[c] ? ' filled' : '');
      td.dataset.r = String(r);
      td.dataset.c = String(c);
    }
  }

  tbl.addEventListener('mousedown', onGridMouseDown);
  tbl.addEventListener('mouseover', onGridMouseOver);
  document.addEventListener('mouseup', () => {
    _dragFill = null;
  });

  elDrawView.dataset.maxRowLen = String(maxRowLen);
  elDrawView.dataset.maxColLen = String(maxColLen);
  elDrawView.innerHTML = '';
  elDrawView.appendChild(tbl);

  updateGridSizeLabel();
}

// ── Cell interaction ────────────────────────────────────────────
let _dragFill: boolean | null = null;

function cellCoords(e: MouseEvent): { td: HTMLElement; r: number; c: number } | null {
  const td = e.target instanceof Element ? e.target.closest<HTMLElement>('td.cell') : null;
  if (!td) return null;
  return { td, r: +(td.dataset.r ?? 0), c: +(td.dataset.c ?? 0) };
}

function onGridMouseDown(e: MouseEvent): void {
  const hit = cellCoords(e);
  if (!hit) return;
  e.preventDefault();
  _dragFill = !state.grid[hit.r]?.[hit.c];
  toggleCell(hit.r, hit.c, _dragFill);
}

function onGridMouseOver(e: MouseEvent): void {
  if (_dragFill === null) return;
  const hit = cellCoords(e);
  if (!hit) return;
  if (state.grid[hit.r]?.[hit.c] !== _dragFill) toggleCell(hit.r, hit.c, _dragFill);
}

function toggleCell(r: number, c: number, fill: boolean): void {
  if (state.grid[r]?.[c] !== fill) onEdit();
  state.grid[r][c] = fill;
  const td = document.querySelector(`td[data-r="${String(r)}"][data-c="${String(c)}"]`);
  if (td) td.className = 'cell' + (fill ? ' filled' : '');
  recomputeClues();
  updateClueCells();
}

function repaintClueSlots(el: HTMLElement, clue: number[], maxLen: number): void {
  const slots = el.querySelectorAll('.clue-slot');
  const nonzero = clue.filter((v) => v > 0);
  const pad = maxLen - nonzero.length;
  slots.forEach((slot, i) => {
    if (i < pad) {
      slot.className = 'clue-slot empty';
      slot.textContent = '';
    } else {
      slot.className = 'clue-slot';
      slot.textContent = String(nonzero[i - pad] ?? '');
    }
  });
}

function updateClueCells(): void {
  const newMaxRowLen = getMaxRowLen();
  const newMaxColLen = getMaxColLen();
  const prevMaxRowLen = parseInt(elDrawView.dataset.maxRowLen ?? '0');
  const prevMaxColLen = parseInt(elDrawView.dataset.maxColLen ?? '0');

  if (newMaxRowLen !== prevMaxRowLen || newMaxColLen !== prevMaxColLen) {
    _dragFill = null;
    buildGrid();
    return;
  }

  for (let r = 0; r < state.rows; r++) {
    const el = $(`rclue-${String(r)}`);
    if (el) repaintClueSlots(el, state.rowClues[r] ?? [], newMaxRowLen);
  }
  for (let c = 0; c < state.cols; c++) {
    const el = $(`cclue-${String(c)}`);
    if (el) repaintClueSlots(el, state.colClues[c] ?? [], newMaxColLen);
  }
}

// ── Dynamic grid sizing ────────────────────────────────────────
function resized(): void {
  recomputeClues();
  buildGrid();
  syncGridToServer();
  onEdit();
}

export function addRow(): void {
  if (state.rows >= MAX_GRID) return;
  state.rows++;
  state.grid.push(Array<boolean>(state.cols).fill(false));
  resized();
}

export function addCol(): void {
  if (state.cols >= MAX_GRID) return;
  state.cols++;
  for (const row of state.grid) row.push(false);
  resized();
}

/** The grid can shrink as well as grow (audit M12). */
export function removeRow(): void {
  if (state.rows <= MIN_GRID) return;
  state.rows--;
  state.grid.pop();
  resized();
}

export function removeCol(): void {
  if (state.cols <= MIN_GRID) return;
  state.cols--;
  for (const row of state.grid) row.pop();
  resized();
}

export function syncGridToServer(): void {
  if (!window.API_BASE) return;
  void fetch(window.API_BASE + '/api/grid', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows: state.rows, cols: state.cols, grid: state.grid }),
  });
}

// ── Puzzle I/O ──────────────────────────────────────────────────
export interface Puzzle {
  row_clues: number[][];
  col_clues: number[][];
}

export function getCurrentPuzzle(): Puzzle {
  recomputeClues();
  return {
    row_clues: state.rowClues,
    col_clues: state.colClues,
  };
}

/** Clear starts over: an empty 3×3, the size the app opens at (audit M12). */
export function doClear(): void {
  state.rows = 3;
  state.cols = 3;
  state.grid = Array.from({ length: state.rows }, () => Array<boolean>(state.cols).fill(false));
  recomputeClues();
  buildGrid();
  syncGridToServer();
  onEdit();
  setStatus('Grid cleared.');
}

interface RawRandomize {
  rows: number;
  cols: number;
  grid: boolean[][];
}

export async function doRandomize(): Promise<void> {
  const rows = state.rows,
    cols = state.cols;
  if (!window.API_BASE) {
    // Offline demo tier: fill a random grid in the browser (the clues follow).
    state.grid = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => Math.random() < 0.5),
    );
    recomputeClues();
    buildGrid();
    onEdit();
    const filled = state.grid.flat().filter(Boolean).length;
    setStatus(`Randomized ${String(rows)}×${String(cols)} puzzle (${String(filled)} filled).`);
    return;
  }
  try {
    const res = await fetch(window.API_BASE + '/api/randomize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, cols }),
    });
    if (!res.ok) {
      setStatus('Randomize failed.', 'err');
      return;
    }
    const data = (await res.json()) as RawRandomize;
    state.rows = data.rows;
    state.cols = data.cols;
    state.grid = data.grid;
    recomputeClues();
    buildGrid();
    syncGridToServer();
    onEdit();
    const filled = state.grid.flat().filter(Boolean).length;
    setStatus(`Randomized ${String(rows)}×${String(cols)} puzzle (${String(filled)} filled).`);
  } catch (err) {
    setStatus('Randomize error: ' + (err instanceof Error ? err.message : String(err)), 'err');
  }
}

export function getBestSolSize(rows: number, cols: number): 'lg' | 'md' | 'sm' {
  const cells = rows * cols;
  if (cells <= 6) return 'lg';
  if (cells <= 16) return 'md';
  return 'sm';
}
