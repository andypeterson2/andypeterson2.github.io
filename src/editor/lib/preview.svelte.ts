// The on-demand PDF preview, extracted from EditorState as a self-contained
// reactive island (tech-debt #11). It owns only its own state and has no tie to
// the editor's save machinery (settle/debounce/seq) — it just compiles the
// active variant and tracks the result. The editor composes it as `editor.preview`
// and injects the two things it needs (is-connected, the active variant) as
// thunks, so the controller reads live reactive values without a back-reference
// to the whole store. This is the pattern for peeling further slices off later.
import { api } from './api';
import type { Variant } from './types';

export class PreviewController {
  /** whether the preview pane is open */
  open = $state(false);
  /** compile lifecycle of the active variant's PDF */
  state = $state<'idle' | 'compiling' | 'ready' | 'error'>('idle');
  /** object URL of the compiled PDF, or null */
  url = $state<string | null>(null);
  /** compiler log shown on failure */
  log = $state<string | null>(null);

  #connected: () => boolean;
  #activeVariant: () => Variant | null;
  #activePersonId: () => number | null;

  constructor(
    connected: () => boolean,
    activeVariant: () => Variant | null,
    activePersonId: () => number | null,
  ) {
    this.#connected = connected;
    this.#activeVariant = activeVariant;
    this.#activePersonId = activePersonId;
  }

  /**
   * Compilable on a live backend when there's something to compile: a named variant,
   * or — for the "Main" (no-variant) view — a loaded profile, which compiles the full
   * document via the base-compile route. The demo is never connected, so it never compiles.
   */
  get compilable(): boolean {
    return this.#connected() && (this.#activeVariant() !== null || this.#activePersonId() !== null);
  }

  toggle() {
    this.open = !this.open;
  }

  /** Drop any compiled PDF — call when the active variant changes (it's now stale). */
  reset() {
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
    this.log = null;
    this.state = 'idle';
  }

  /** Compile the active variant — or the full "Main" document — to a PDF (manual; xelatex is costly). */
  async compile() {
    if (!this.#connected()) return;
    const v = this.#activeVariant();
    const pid = this.#activePersonId();
    if (!v && pid == null) return;
    this.state = 'compiling';
    this.log = null;
    const res = v ? await api.compilePdf(v.id) : await api.compileMainPdf(pid!);
    if (res.ok && res.data) {
      if (this.url) URL.revokeObjectURL(this.url);
      this.url = URL.createObjectURL(res.data);
      this.state = 'ready';
    } else {
      this.log = res.error?.message ?? 'Compile failed';
      this.state = 'error';
    }
  }
}
