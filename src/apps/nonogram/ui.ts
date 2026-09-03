/* =============================================================
   Status line, busy state, and grid-size label — tiny UI helpers
   shared by grid.ts / solver.ts / app.ts (kept separate to avoid
   an import cycle through app.ts).
   ============================================================= */

import { state, $, must } from './state';

export function setStatus(msg: string, level?: 'err' | 'ok'): void {
  const el = $('status-line');
  if (!el) return;
  el.textContent = msg;
  el.className =
    'status-line' + (level === 'err' ? ' status-err' : level === 'ok' ? ' status-ok' : '');
}

export function setBusy(busy: boolean): void {
  state.busy = busy;
  const btn = must('btn-bench') as HTMLButtonElement;
  btn.disabled = busy;
  btn.textContent = busy ? 'Running…' : '▶ Run on Simulator';
  (must('btn-clear') as HTMLButtonElement).disabled = busy;
  (must('btn-random') as HTMLButtonElement).disabled = busy;
  (must('btn-add-row') as HTMLButtonElement).disabled = busy;
  (must('btn-add-col') as HTMLButtonElement).disabled = busy;
}

export function updateGridSizeLabel(): void {
  must('grid-size-label').textContent = `${String(state.rows)} × ${String(state.cols)}`;
}
