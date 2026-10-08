// The symbols palette, shared by the whole editor: one open state and one record of
// the field a glyph should land in. The toolbar renders the Ω toggle and the popup;
// every text field in the document feeds `track` through the editor root's focusin,
// so a glyph goes wherever the caret last was.

import { insertAtCaret } from './caret';

function createSymbols() {
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
    close() {
      open = false;
    },
    /** Remember the focused text field, so a palette-chip click knows where to insert. */
    track(e: FocusEvent) {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) field = t;
    },
    /** Insert a glyph at the last-focused field's caret, and hand focus back to it. */
    insert(glyph: string) {
      if (!field) return;
      insertAtCaret(field, glyph);
      field.focus();
    },
  };
}

export const symbols = createSymbols();
