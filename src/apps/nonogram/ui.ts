/**
 * Status line, busy state, and grid-size label — tiny UI helpers
 * shared by the grid, solver and app modules (kept separate to avoid
 * an import cycle through the app module).
 */

import { state, $, must } from './state';
import { MAX_HW_CELLS, currentStatus } from './hardware';

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
 * The IBM button says what pressing it would actually do.
 *
 * Spending quantum credits takes an account the owner has allowed, so a visitor
 * without one is offered the sign-in rather than a button that fails when pressed.
 * The size ceiling shows as a disabled button rather than a hidden one, so the limit
 * is visible instead of mysterious.
 */
export function applyHardwareControl(): void {
  const btn = must('btn-hw') as HTMLButtonElement;
  const status = currentStatus();
  btn.hidden = false;

  // Nothing to ask: on the browser tier there is no gateway to answer, and a probe
  // that failed leaves the same nothing.
  if (!window.API_BASE || !status) {
    btn.textContent = '▶ Run on IBM';
    btn.disabled = true;
    btn.title = 'Real hardware runs through the live backend, which is not connected.';
    return;
  }
  if (!status.configured) {
    btn.textContent = '▶ Run on IBM';
    btn.disabled = true;
    btn.title = status.reason;
    return;
  }

  // No account yet: the button becomes the way to get one.
  if (!status.signedIn) {
    btn.textContent = 'Sign in to run on IBM';
    btn.disabled = state.busy;
    btn.title = status.reason;
    return;
  }

  btn.textContent = '▶ Run on IBM';
  const tooBig = state.rows * state.cols > MAX_HW_CELLS;
  btn.disabled = state.busy || tooBig || !status.allowed;
  btn.title = tooBig
    ? `Hardware runs stop at ${String(MAX_HW_CELLS)} cells — past that the circuit is deeper than the device holds, and the result is noise.`
    : status.reason;
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
