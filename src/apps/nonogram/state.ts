/* State & DOM references — shared across the nonogram modules. */

export interface HistData {
  /** [bitstring, probability] sorted desc, capped to MAX_DISPLAY. */
  entries: [string, number][];
  /**
   * The measured grids that satisfy the clues, checked rather than inferred.
   *
   * Taken over every outcome the run produced, so a grid measured too rarely for the
   * chart to draw is still reported.
   */
  verified: [string, number][];
  rows: number;
  cols: number;
  totalOutcomes?: number;
}

/** Draw a grid and read its clues off it, or type the clues and let the solver answer. */
export type EditorMode = 'draw' | 'clues';

export interface NonogramState {
  mode: EditorMode;
  rows: number;
  cols: number;
  /** 2-D bool array [row][col]. In clues mode it holds whatever was drawn last. */
  grid: boolean[][];
  /** One run-length clue per row: read off the grid while drawing, typed in clues mode. */
  rowClues: number[][];
  colClues: number[][];
  busy: boolean;
  histData: HistData | null;
  /** User-set threshold value (preserved across runs). */
}

export const state: NonogramState = {
  mode: 'draw',
  rows: 3,
  cols: 3,
  grid: [],
  rowClues: [],
  colClues: [],
  busy: false,
  histData: null,
};

/**
 * This tab's name for its own results. The solver addresses every emit to a room
 * named by this, so one visitor's run never lands in another's window. It is kept in
 * sessionStorage because the socket's own id is reissued on every reconnect, and a
 * reload would otherwise leave a run with nowhere to be delivered.
 */
const CLIENT_KEY = 'nonogram.client';

export function clientId(): string {
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

// Helpers
export const $ = (id: string): HTMLElement | null => document.getElementById(id);

/** Like $, but for elements the page markup guarantees. */
export function must(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`nonogram app: #${id} missing from the page`);
  return el;
}

// DOM references (the markup precedes the module scripts)
export const elDrawView = must('draw-view');
export const elQuPlaceholder = must('qu-placeholder');
export const elClPlaceholder = must('cl-placeholder');
export const elQuList = must('qu-list');
/** Held by reference: renderQuantumList detaches it, so an id lookup can miss it later. */
export const elQuSolPlaceholder = must('qu-sol-placeholder');

const histEl = document.getElementById('qu-histogram');
if (!(histEl instanceof SVGSVGElement))
  throw new Error('nonogram app: #qu-histogram missing (or not an <svg>)');
export const elHistSvg = histEl;

