/**
 * Status line, busy state, and grid-size label — tiny UI helpers
 * shared by the grid, solver and app modules (kept separate to avoid
 * an import cycle through the app module).
 */

import { state, $, must } from './state';
import { MAX_HW_CELLS, currentStatus, isSignedIn } from './hardware';

/**
 * The status line.
 *
 * Colour is the design's one signal for a machine reporting state, and a fault is the
 * only state worth spending it on; everything else is ink like the rest of the page.
 */
export function setStatus(msg: string, level?: 'err'): void {
  const el = $('status-line');
  if (!el) return;
  el.textContent = msg;
  el.className = 'status-line' + (level === 'err' ? ' status-err' : '');
}

/** Where the run button sends the puzzle. */
export type RunWhere = 'local' | 'hardware';

let where: RunWhere = 'local';

export function runWhere(): RunWhere {
  return where;
}

export function setRunWhere(next: RunWhere): void {
  where = next;
  for (const [id, name] of [
    ['btn-where-local', 'local'],
    ['btn-where-hw', 'hardware'],
  ] as const) {
    $(id)?.setAttribute('aria-pressed', String(name === where));
  }
  applyTierControls();
}

/** What the run button will actually do, in the words of where it will do it. */
function benchLabel(): string {
  if (where === 'hardware') return '▶ Hardware solve';
  return window.API_BASE ? '▶ Simulator solve' : '▶ Local solve';
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

/**
 * The run button says what pressing it would actually do.
 *
 * Set to hardware it carries the same account and size checks the separate IBM button
 * used to: spending quantum credits takes an account the owner has allowed, and a board
 * past the size ceiling would come back as noise. Set to local there is nothing to ask.
 */
export function applyHardwareControl(): void {
  const btn = must('btn-bench') as HTMLButtonElement;
  const status = currentStatus();
  if (where === 'local') {
    btn.removeAttribute('aria-disabled');
    btn.removeAttribute('title');
    return;
  }
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
  (must('btn-reset') as HTMLButtonElement).disabled = busy;
  for (const id of ['btn-mode-draw', 'btn-mode-clues', 'btn-where-local', 'btn-where-hw']) {
    (must(id) as HTMLButtonElement).disabled = busy;
  }
  for (const id of ['size-rows', 'size-cols']) {
    const field = $(id);
    if (field instanceof HTMLInputElement) field.disabled = busy;
  }
  applyHardwareControl();
}

/** The size is typed into the grid's own corner; this is what follows a change of it. */
export function updateGridSizeLabel(): void {
  // Whether a real device can say anything about this puzzle changes with its size,
  // and this runs on every rebuild.
  applyHardwareControl();
}
