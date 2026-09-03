/* =============================================================
   State & DOM references — shared across the nonogram modules.
   ============================================================= */

export interface HistData {
  /** [bitstring, probability] sorted desc, capped to MAX_DISPLAY. */
  entries: [string, number][];
  threshold: number;
  rows: number;
  cols: number;
  totalOutcomes?: number;
}

export interface NonogramState {
  rows: number;
  cols: number;
  /** 2-D bool array [row][col]. */
  grid: boolean[][];
  /** One run-length clue per row (derived from grid). */
  rowClues: number[][];
  colClues: number[][];
  busy: boolean;
  histData: HistData | null;
  /** User-set threshold value (preserved across runs). */
  userThreshold: number | null;
}

export const state: NonogramState = {
  rows: 3,
  cols: 3,
  grid: [],
  rowClues: [],
  colClues: [],
  busy: false,
  histData: null,
  userThreshold: null,
};

// ── Helpers ────────────────────────────────────────────────────
export const $ = (id: string): HTMLElement | null => document.getElementById(id);

/** Like $, but for elements the page markup guarantees. */
export function must(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`nonogram app: #${id} missing from the page`);
  return el;
}

// ── DOM references (the markup precedes the module scripts) ────
export const elDrawView = must('draw-view');
export const elQuPlaceholder = must('qu-placeholder');
export const elClPlaceholder = must('cl-placeholder');
export const elQuList = must('qu-list');

const histEl = document.getElementById('qu-histogram');
if (!(histEl instanceof SVGSVGElement))
  throw new Error('nonogram app: #qu-histogram missing (or not an <svg>)');
export const elHistSvg = histEl;

const thresholdEl = document.getElementById('threshold-input');
if (!(thresholdEl instanceof HTMLInputElement))
  throw new Error('nonogram app: #threshold-input missing (or not an <input>)');
export const elThresholdInput = thresholdEl;
