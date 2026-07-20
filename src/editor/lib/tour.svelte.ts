// The guided tour's reactive shell: step sequencing, the dwell timer, and the
// interrupt. The testable logic lives in ./tour — this file holds the runes.
//
// Composed through an injected host like the other slice controllers (see
// store.svelte.ts), so the machine never reaches into the store. The tour runs
// in demo for anyone, and for a signed-in owner too — there `stage()`/`restore()`
// sandbox it: it drives the real CV through the same public calls, but its one
// mutation is an ephemeral bullet, and the document is snapshotted on entry and
// put back untouched on exit, so nothing it does persists (see store.stageTour).
import { DWELL_MS, prefersReducedMotion, type TourStep } from './tour';
import { editor } from './store.svelte';
import { tourSteps } from './tour-steps';

export interface TourHost {
  /** Demo runs for anyone; a signed-in owner tours their own CV (needs a profile). */
  canRun(): boolean;
  /** True when a signed-in session is driving — the tour is sandboxed, not on demo data. */
  isLive(): boolean;
  /**
   * Prepare the stage before playing. Demo → restore the pristine sample
   * (determinism beats continuity). Signed in → capture the live document so the
   * tour can drive it and put it back untouched afterwards.
   */
  stage(): void;
  /**
   * Tear down after the tour. Demo → leave the document as the tour left it (the
   * visitor keeps exploring; nothing is saved anyway); signed in → restore the
   * captured document, wiping every ephemeral edit. Paired with stage().
   */
  restore(): void;
  /** Narrate through the editor's ONE aria-live region; never add a second. */
  announce(msg: string): void;
  /**
   * Put away chrome the tour opened (the variant drawer, at step 5) so a modal
   * scrim never outlives the tour that raised it. Demo-facing: a signed-in restore
   * already returns the drawer to wherever the owner had it.
   */
  closeChrome(): void;
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
  /** connected-ness captured at start(): the tour is staged for this mode. If the
   *  session flips mid-tour (a sign-in popup lands), Editor.svelte ends it. */
  liveAtStart = $state(false);

  /** in-flight step (aborted on interrupt), the dwell timer, and a generation counter */
  #ac: AbortController | null = null;
  #dwell: ReturnType<typeof setTimeout> | null = null;
  #run = 0;

  constructor(private host: TourHost) {}

  /** Playing or paused — i.e. the controller is on screen and owns the app. */
  active = $derived(this.state === 'playing' || this.state === 'paused');
  caption = $derived(this.steps[this.index]?.caption ?? '');
  /** selector for the element to glide to + frame this step; '' → no spotlight */
  spot = $derived(this.steps[this.index]?.spot ?? '');
  /** narrow-viewport spotlight override; '' → fall back to `spot` (see TourStep.spotMobile) */
  spotMobile = $derived(this.steps[this.index]?.spotMobile ?? '');
  total = $derived(this.steps.length);

  start() {
    if (!this.host.canRun()) return;
    const steps = this.host.steps();
    if (!steps.length) return;
    this.liveAtStart = this.host.isLive();
    this.host.stage();
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
    // A signed-in owner grabbing the wheel gets their real CV back at once —
    // restored and untouched — rather than a paused tour they'd edit through.
    if (this.liveAtStart) {
      this.end();
      return;
    }
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

  /** Dismiss outright (✕ or Esc). Restore first: a signed-in owner gets their CV back. */
  end() {
    this.#cancel();
    this.host.closeChrome();
    this.host.restore();
    this.state = 'idle';
    this.index = 0;
  }

  /** Ran off the end — put the document back, then offer the undo the invite promised. */
  #finish() {
    this.#cancel();
    this.host.closeChrome();
    this.host.restore();
    this.state = 'done';
    this.host.announce('Tour complete — nothing was saved.');
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
  // Demo for anyone; a signed-in owner tours their own CV, but only once a profile
  // is loaded (an empty account has nothing to show).
  canRun: () => !editor.connected || editor.activePersonId != null,
  isLive: () => editor.connected,
  stage: () => editor.stageTour(),
  restore: () => editor.unstageTour(),
  announce: (msg) => editor.narrate(msg),
  closeChrome: () => {
    editor.openDrawer = null;
  },
  steps: tourSteps,
});
