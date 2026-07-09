// Shared glue for the symbols palette (increment 2), so every editor wires it the
// same way: a factory holding the palette's open state and the "last-focused
// field" it inserts into. Each editor calls `symbolInput()` once, binds `track`
// to its root's focusin, and renders an Ω toggle, a <SymbolPalette>, and an
// <UnknownWarning>. The transform + the allowlist stay in symbols.ts; this is
// only the per-editor UI state.
import { insertAtCaret } from './caret';

export function symbolInput() {
  let open = $state(false);
  // Not reactive: it only feeds `insert`, which reads it at click time.
  let field: HTMLInputElement | HTMLTextAreaElement | null = null;

  return {
    get open() {
      return open;
    },
    toggle() {
      open = !open;
    },
    /** Remember the focused text field, so a palette-chip click knows where to insert. */
    track(e: FocusEvent) {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) field = t;
    },
    /** Insert a glyph at the last-focused field's caret (no-op if none yet). */
    insert(glyph: string) {
      if (field) insertAtCaret(field, glyph);
    },
  };
}
