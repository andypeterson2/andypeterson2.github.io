/**
 * Status line, busy state, and grid-size label — tiny UI helpers
 * shared by the grid, solver and app modules (kept separate to avoid
 * an import cycle through the app module).
 */

import { state, $, must } from './state';
import { MAX_HW_CELLS, currentStatus, isSignedIn } from './hardware';

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
 *  sitting there inert. */
export function applyTierControls(): void {
  const btn = must('btn-bench') as HTMLButtonElement;
  if (!state.busy) btn.textContent = benchLabel();
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
/** Said the same way wherever hardware is out of reach for want of an account. */
const NEEDS_ACCOUNT =
  'Running on a real quantum computer needs an authenticated account — sign in from the menu bar.';

/**
 * Mark a control unavailable while leaving it reachable.
 *
 * `aria-disabled` rather than `disabled`: the reason lives in the title, and a
 * natively disabled button is skipped by the tab order and answers no hover, so the
 * reason would be unreadable for exactly the people most likely to need it.
 */
function setUnavailable(btn: HTMLButtonElement, reason: string): void {
  btn.setAttribute('aria-disabled', 'true');
  btn.title = reason;
}

function setAvailable(btn: HTMLButtonElement, hint: string): void {
  btn.removeAttribute('aria-disabled');
  btn.title = hint;
}

/** Whether a click on this control should do nothing. */
export function isUnavailable(btn: HTMLButtonElement): boolean {
  return btn.getAttribute('aria-disabled') === 'true';
}

export function applyHardwareControl(): void {
  const btn = must('btn-hw') as HTMLButtonElement;
  const status = currentStatus();
  btn.hidden = false;

  // Nothing to ask: on the browser tier there is no gateway to answer, and a probe
  // that failed leaves the same nothing.
  btn.textContent = '▶ Run on IBM';
  // Asked first because it is what stops most visitors, and because the menu bar
  // knows the answer on every page, with or without a backend awake.
  if (isSignedIn() === false) {
    setUnavailable(btn, NEEDS_ACCOUNT);
    return;
  }
  if (!window.API_BASE || !status) {
    setUnavailable(btn, 'Real hardware runs through the live backend, which is not connected.');
    return;
  }
  if (!status.configured) {
    setUnavailable(btn, status.reason);
    return;
  }

  // No account yet: the run button says why it cannot be pressed, and the sign-in
  // bar below the controls is what does something about it.
  if (!status.signedIn) {
    setUnavailable(btn, NEEDS_ACCOUNT);
    return;
  }

  const tooBig = state.rows * state.cols > MAX_HW_CELLS;
  if (tooBig) {
    setUnavailable(
      btn,
      `Hardware runs stop at ${String(MAX_HW_CELLS)} cells — past that the circuit is deeper than the device holds, and the result is noise.`,
    );
    return;
  }
  if (state.busy || !status.allowed) setUnavailable(btn, status.reason);
  else setAvailable(btn, status.reason);
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
