/**
 * Status line, busy state, and grid-size label — tiny UI helpers
 * shared by the grid, solver and app modules (kept separate to avoid
 * an import cycle through the app module).
 */

import { state, $, must } from './state';

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
}

export function setBusy(busy: boolean): void {
  state.busy = busy;
  const btn = must('btn-bench') as HTMLButtonElement;
  btn.disabled = busy;
  btn.textContent = busy ? 'Running…' : benchLabel();
  (must('btn-clear') as HTMLButtonElement).disabled = busy;
  (must('btn-random') as HTMLButtonElement).disabled = busy;
  for (const id of ['btn-add-row', 'btn-add-col', 'btn-remove-row', 'btn-remove-col']) {
    (must(id) as HTMLButtonElement).disabled = busy;
  }
}

export function updateGridSizeLabel(): void {
  must('grid-size-label').textContent = `${String(state.rows)} × ${String(state.cols)}`;
}
