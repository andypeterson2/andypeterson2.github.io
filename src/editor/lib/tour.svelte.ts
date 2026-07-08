// The guided tour's reactive shell: step sequencing, the dwell timer, and the
// interrupt. The testable logic lives in ./tour — this file holds the runes.
//
// Composed through an injected host like the other slice controllers (see
// store.svelte.ts), so the machine never reaches into the store. `canRun()` is
// the single place that keeps the tour away from a signed-in owner: the tour
// *writes* (it adds a bullet), and a write against a live backend would edit a
// real CV. Demo only, enforced here rather than at each call site.
import { DWELL_MS, prefersReducedMotion, type TourStep } from './tour';
import { editor } from './store.svelte';
import { tourSteps } from './tour-steps';

export interface TourHost {
  /** Demo only — a signed-in owner has real data, and the tour mutates. */
  canRun(): boolean;
  /** Restore the pristine demo before playing: determinism beats continuity. */
  reset(): void;
  /** Narrate through the editor's ONE aria-live region; never add a second. */
  announce(msg: string): void;
  steps(): TourStep[];
}

export type TourState = 'idle' | 'playing' | 'paused' | 'done';

export class TourController {
  state = $state<TourState>('idle');
  index = $state(0);
  /** raw: steps are immutable data, and deep-proxying their `enter` closures buys nothing. */
  steps = $state.raw<TourStep[]>([]);
  /** reduced motion → no auto-advance; the visitor steps through with Next ▸. */
  manual = $state(false);

  /** in-flight step (aborted on interrupt), the dwell timer, and a generation counter */
  #ac: AbortController | null = null;
  #dwell: ReturnType<typeof setTimeout> | null = null;
  #run = 0;

  constructor(private host: TourHost) {}

  /** Playing or paused — i.e. the controller is on screen and owns the app. */
  active = $derived(this.state === 'playing' || this.state === 'paused');
  caption = $derived(this.steps[this.index]?.caption ?? '');
  total = $derived(this.steps.length);

  start() {
    if (!this.host.canRun()) return;
    const steps = this.host.steps();
    if (!steps.length) return;
    this.host.reset();
    this.steps = steps;
    this.manual = prefersReducedMotion();
    this.index = 0;
    this.state = 'playing';
    void this.#enter();
  }

  /** Apply the current step, then schedule the next. Cancels anything in flight. */
  async #enter() {
    this.#cancel();
    const run = this.#run;
    const step = this.steps[this.index];
    if (!step) {
      this.#finish();
      return;
    }
    this.host.announce(step.caption);
    const ac = new AbortController();
    this.#ac = ac;
    try {
      await step.enter(ac.signal);
    } catch {
      return; // the step gave up (aborted mid-typewriter)
    }
    // A newer run, an interrupt, or an end() landed while we were awaiting.
    if (ac.signal.aborted || run !== this.#run || this.state !== 'playing') return;
    if (this.manual) return; // reduced motion: wait for Next ▸
    this.#dwell = setTimeout(() => this.next(), DWELL_MS);
  }

  next() {
    if (!this.active) return;
    if (this.index + 1 >= this.steps.length) {
      this.#finish();
      return;
    }
    this.index += 1;
    this.state = 'playing';
    void this.#enter();
  }

  /** The visitor twitched. Let go at once — never fight them for the wheel. */
  takeover() {
    if (this.state !== 'playing') return;
    this.#cancel();
    this.state = 'paused';
    this.host.announce('Tour paused — you have the wheel.');
  }

  /** Re-enter the current step, so the narration matches what is on screen. */
  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    void this.#enter();
  }

  toggle() {
    if (this.state === 'paused') this.resume();
    else this.takeover();
  }

  /** Dismiss outright (✕ or Esc). */
  end() {
    this.#cancel();
    this.state = 'idle';
    this.index = 0;
  }

  /** Ran off the end — offer the undo the invitation promised. */
  #finish() {
    this.#cancel();
    this.state = 'done';
    this.host.announce('Tour complete. The demo is yours — nothing was saved.');
  }

  /** Abort the in-flight step and cancel the dwell, invalidating the generation. */
  #cancel() {
    this.#run += 1;
    if (this.#dwell) clearTimeout(this.#dwell);
    this.#dwell = null;
    this.#ac?.abort();
    this.#ac = null;
  }
}

export const tour = new TourController({
  canRun: () => !editor.connected,
  reset: () => editor.resetDemo(),
  announce: (msg) => editor.narrate(msg),
  steps: tourSteps,
});
