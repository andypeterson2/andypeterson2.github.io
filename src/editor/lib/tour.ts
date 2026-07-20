// The guided tour's pure core — the step contract, its motion tokens, the
// typewriter, and the one rule that decides when a visitor has taken the wheel.
//
// Deliberately runes-free: vitest here has no Svelte plugin, so anything living
// in a `.svelte.ts` module is unreachable from a unit test (which is why the
// other slice controllers have none). The logic worth pinning therefore lives in
// this plain module; `tour.svelte.ts` keeps only the reactive shell and the timers.

/** A step drives the REAL editor — the same store calls a visitor's clicks make. */
export interface TourStep {
  id: string;
  caption: string;
  /**
   * Apply this step's state. Re-invoked on Resume, so it MUST be idempotent:
   * re-entering "type a bullet" has to land on the same bullet, not a second one.
   * Anything slow (the typewriter) must give up promptly once `signal` aborts.
   */
  enter(signal: AbortSignal): void | Promise<void>;
  /**
   * CSS selector for the element this step acts on. The tour glides the page to it
   * and frames it — the "look here" cue. Resolved live (after `enter`), so it can
   * name what the step just opened or created. Absent → no spotlight for that step.
   */
  spot?: string;
  /**
   * Narrow-viewport override for `spot`. At/below 768px the toolbar folds into the ☰
   * menu, so a target like the variant picker or Export button is `display:none` and
   * would frame nothing. Such a step names a stand-in the phone actually shows — the
   * document the variant re-renders, or the ☰ Menu that now holds the command.
   * Absent → `spot` is used on every viewport.
   */
  spotMobile?: string;
}

/**
 * Motion tokens. System 6 had no animation, so there is no easing to tune: the
 * only motion is a mechanical dwell between steps and a human typing cadence.
 * Plain numbers rather than CSS custom properties because only JS reads them —
 * a `--dwell-step` that no stylesheet consumes would be dead code.
 */
export const DWELL_MS = 6400; // an unhurried read of each caption before it auto-advances
export const TYPE_MS = 28;

/** The tour moves the page, which is a vestibular hazard — honour the opt-out. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Resolve after `ms`, or at once if aborted. Resolves `true` when it was aborted. */
export function sleep(ms: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(true);
  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve(false);
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Type `text` into `apply` one character at a time, abandoning mid-word the
 * instant `signal` aborts. Under reduced motion the text simply appears.
 */
export async function typeText(
  text: string,
  apply: (partial: string) => void,
  signal: AbortSignal,
  perChar = TYPE_MS,
): Promise<void> {
  if (signal.aborted) return;
  if (perChar <= 0 || prefersReducedMotion()) {
    apply(text);
    return;
  }
  for (let i = 1; i <= text.length; i += 1) {
    apply(text.slice(0, i));
    if (await sleep(perChar, signal)) return;
  }
}

/** What a stray event means for a running tour. */
export type TourIntent = 'ignore' | 'end' | 'toggle' | 'yield';

/** Bare modifiers aren't intent — nobody takes the wheel by pressing Shift. */
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'OS']);

export interface TourEvent {
  type: 'keydown' | 'pointerdown' | 'wheel';
  key?: string;
  /** the event started inside the tour's own controller (its buttons are not an interrupt) */
  insideTour?: boolean;
  /** the event targets a text field, where Space types a character rather than commanding */
  editable?: boolean;
}

/**
 * The signature interaction. Any touch outside the tour's own chrome hands
 * control straight back to the visitor: Esc ends it, Space pauses or resumes,
 * and everything else — a click, a keystroke, a scroll — means "I'm driving now".
 */
export function tourIntent(e: TourEvent): TourIntent {
  if (e.insideTour) return 'ignore';
  if (e.type !== 'keydown') return 'yield';
  if (e.key && MODIFIERS.has(e.key)) return 'ignore';
  if (e.key === 'Escape') return 'end';
  if ((e.key === ' ' || e.key === 'Spacebar') && !e.editable) return 'toggle';
  return 'yield';
}
