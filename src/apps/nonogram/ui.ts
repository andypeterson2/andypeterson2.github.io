/**
 * Status line, busy state, and grid-size label — tiny UI helpers
 * shared by the grid, solver and app modules (kept separate to avoid
 * an import cycle through the app module).
 */

import { state, $, must } from './state';
import { MAX_HW_CELLS } from './hardware';

export function setStatus(msg: string, level?: 'err' | 'ok'): void {
  const el = $('status-line');
  if (!el) return;
  el.textContent = msg;
  el.className =
    'status-line' + (level === 'err' ? ' status-err' : level === 'ok' ? ' status-ok' : '');
}

/** What the run button will actually do: offline it solves classically in the
 *  browser; with a live backend it runs the Grover simulator. */
function benchLabel(): string {
  return window.API_BASE ? '▶ Run on simulator' : '▶ Solve in browser';
}

/** Controls that only mean something with a live backend say so instead of
 *  sitting there inert: Trials is disabled offline, with the reason on hover. */
export function applyTierControls(): void {
  const btn = must('btn-bench') as HTMLButtonElement;
  if (!state.busy) btn.textContent = benchLabel();
  const trials = must('trials-input') as HTMLInputElement;
  trials.disabled = !window.API_BASE;
  trials.title = window.API_BASE ? '' : 'Trials repeat a live quantum run — needs the live solver';
  applyHardwareControl();
}

/**
 * The IBM button appears only with a live backend, and only for a grid a real device
 * can say something about. It is shown disabled rather than hidden at the wrong size,
 * so the ceiling is visible instead of mysterious.
 */
export function applyHardwareControl(): void {
  const btn = must('btn-hw') as HTMLButtonElement;
  btn.hidden = !window.API_BASE;
  if (btn.hidden) return;
  const cells = state.rows * state.cols;
  const tooBig = cells > MAX_HW_CELLS;
  btn.disabled = state.busy || tooBig;
  btn.title = tooBig
    ? `Hardware runs stop at ${String(MAX_HW_CELLS)} cells — past that the circuit is deeper than the device holds, and the result is noise.`
    : 'Submit this puzzle to a real IBM quantum computer. Needs a signed-in account.';
}

export function setBusy(busy: boolean): void {
  state.busy = busy;
  const btn = must('btn-bench') as HTMLButtonElement;
  btn.disabled = busy;
  btn.textContent = busy ? 'Running…' : benchLabel();
  (must('btn-clear') as HTMLButtonElement).disabled = busy;
  (must('btn-random') as HTMLButtonElement).disabled = busy;
  for (const id of [
    'btn-add-row',
    'btn-add-col',
    'btn-remove-row',
    'btn-remove-col',
    'btn-mode-draw',
    'btn-mode-clues',
  ]) {
    (must(id) as HTMLButtonElement).disabled = busy;
  }
  applyHardwareControl();
}

export function updateGridSizeLabel(): void {
  must('grid-size-label').textContent = `${String(state.rows)} × ${String(state.cols)}`;
  // Whether a real device can say anything about this puzzle changes with its size,
  // and this runs on every rebuild.
  applyHardwareControl();
}
