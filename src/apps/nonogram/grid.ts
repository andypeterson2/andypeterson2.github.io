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

// An empty line's clue is a 0, the puzzle convention; a blank header also told a
// screen reader nothing (axe empty-table-header).
function shownRuns(clue: number[]): number[] {
  const runs = clue.filter((v) => v > 0);
  return runs.length ? runs : [0];
}

function makeClueContent(clue: number[], maxLen: number, className: string): HTMLDivElement {
  const nonzero = shownRuns(clue);
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
// The grid is a keyboard widget as well as a drawing surface (audit M24): each cell
// holds a toggle button named "Row r, column c", one of which is in the tab order
// (roving tabindex); arrows, Home and End move, Space or Enter fills. The clues are
// the table's row and column headers, so a screen reader hears them as it moves.
let focusR = 0;
let focusC = 0;

function clueLabel(kind: 'Row' | 'Column', i: number, clue: number[]): string {
  return `${kind} ${String(i + 1)} clue: ${shownRuns(clue).join(' ')}`;
}

function clueHeader(
  scope: 'row' | 'col',
  id: string,
  label: string,
  content: HTMLElement,
): HTMLTableCellElement {
  const th = document.createElement('th');
  th.scope = scope;
  th.className = scope === 'row' ? 'row-clue' : 'col-clue';
  th.id = id;
  th.setAttribute('aria-label', label);
  th.appendChild(content);
  return th;
}

function cellButton(r: number, c: number): HTMLButtonElement | null {
  return elDrawView.querySelector<HTMLButtonElement>(
    `td[data-r="${String(r)}"][data-c="${String(c)}"] > button`,
  );
}

export function buildGrid(): void {
  const rows = state.rows,
    cols = state.cols;
  const maxRowLen = getMaxRowLen();
  const maxColLen = getMaxColLen();
  focusR = Math.min(focusR, rows - 1);
  focusC = Math.min(focusC, cols - 1);
  const hadFocus = elDrawView.contains(document.activeElement);

  const tbl = document.createElement('table');
  tbl.className = 'nonogram-table';
  tbl.setAttribute('aria-label', `Puzzle grid, ${String(rows)} by ${String(cols)}`);

  // ── Header row: corner + col clues ──
  const hdr = tbl.insertRow();

  const corner = hdr.insertCell();
  corner.className = 'corner-cell';

  for (let c = 0; c < cols; c++) {
    const clue = state.colClues[c] ?? [];
    hdr.appendChild(
      clueHeader(
        'col',
        `cclue-${String(c)}`,
        clueLabel('Column', c, clue),
        makeClueContent(clue, maxColLen, 'col-clue-slots'),
      ),
    );
  }

  // ── Data rows ──
  for (let r = 0; r < rows; r++) {
    const tr = tbl.insertRow();
    const clue = state.rowClues[r] ?? [];
    tr.appendChild(
      clueHeader(
        'row',
        `rclue-${String(r)}`,
        clueLabel('Row', r, clue),
        makeClueContent(clue, maxRowLen, 'row-clue-slots'),
      ),
    );

    for (let c = 0; c < cols; c++) {
      const filled = state.grid[r]?.[c];
      const td = tr.insertCell();
      td.className = 'cell' + (filled ? ' filled' : '');
      td.dataset.r = String(r);
      td.dataset.c = String(c);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cell-btn';
      btn.setAttribute('aria-label', `Row ${String(r + 1)}, column ${String(c + 1)}`);
      btn.setAttribute('aria-pressed', String(filled));
      btn.tabIndex = r === focusR && c === focusC ? 0 : -1;
      td.appendChild(btn);
    }
  }

  tbl.addEventListener('mousedown', onGridMouseDown);
  tbl.addEventListener('mouseover', onGridMouseOver);
  tbl.addEventListener('keydown', onGridKey);
  tbl.addEventListener('click', onGridClick);
  document.addEventListener('mouseup', () => {
    _dragFill = null;
  });

  elDrawView.dataset.maxRowLen = String(maxRowLen);
  elDrawView.dataset.maxColLen = String(maxColLen);
  elDrawView.innerHTML = '';
  elDrawView.appendChild(tbl);
  // A rebuild (the clues outgrew their slots, or a resize) mustn't drop keyboard focus.
  if (hadFocus) cellButton(focusR, focusC)?.focus();

  updateGridSizeLabel();
}

// ── Cell interaction ────────────────────────────────────────────
let _dragFill: boolean | null = null;

function cellCoords(e: Event): { td: HTMLElement; r: number; c: number } | null {
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

// Space and Enter on a cell arrive as a click with detail 0. A pointer's click
// (detail >= 1) is ignored: its mousedown already toggled the cell.
function onGridClick(e: MouseEvent): void {
  if (e.detail !== 0) return;
  const hit = cellCoords(e);
  if (hit) toggleCell(hit.r, hit.c, !state.grid[hit.r]?.[hit.c]);
}

const MOVES: Partial<Record<string, [number, number]>> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

function onGridKey(e: KeyboardEvent): void {
  const hit = cellCoords(e);
  if (!hit) return;
  const move = MOVES[e.key];
  let r = hit.r;
  let c = hit.c;
  if (move) {
    r = Math.max(0, Math.min(state.rows - 1, r + move[0]));
    c = Math.max(0, Math.min(state.cols - 1, c + move[1]));
  } else if (e.key === 'Home') c = 0;
  else if (e.key === 'End') c = state.cols - 1;
  else return;
  e.preventDefault();
  moveFocus(r, c, true);
}

/** The one cell in the tab order follows the last cell used, by key or pointer. */
function moveFocus(r: number, c: number, focus: boolean): void {
  cellButton(focusR, focusC)?.setAttribute('tabindex', '-1');
  focusR = r;
  focusC = c;
  const btn = cellButton(r, c);
  if (!btn) return;
  btn.tabIndex = 0;
  if (focus) btn.focus();
}

function toggleCell(r: number, c: number, fill: boolean): void {
  if (state.grid[r]?.[c] !== fill) onEdit();
  state.grid[r][c] = fill;
  const td = document.querySelector(`td[data-r="${String(r)}"][data-c="${String(c)}"]`);
  if (td) td.className = 'cell' + (fill ? ' filled' : '');
  cellButton(r, c)?.setAttribute('aria-pressed', String(fill));
  moveFocus(r, c, false);
  recomputeClues();
  updateClueCells();
}

function repaintClueSlots(el: HTMLElement, clue: number[], maxLen: number, label: string): void {
  el.setAttribute('aria-label', label);
  const slots = el.querySelectorAll('.clue-slot');
  const nonzero = shownRuns(clue);
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
    const clue = state.rowClues[r] ?? [];
    if (el) repaintClueSlots(el, clue, newMaxRowLen, clueLabel('Row', r, clue));
  }
  for (let c = 0; c < state.cols; c++) {
    const el = $(`cclue-${String(c)}`);
    const clue = state.colClues[c] ?? [];
    if (el) repaintClueSlots(el, clue, newMaxColLen, clueLabel('Column', c, clue));
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
