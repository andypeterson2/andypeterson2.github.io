/**
 * Splice `text` into an `<input>`/`<textarea>` at the caret (replacing any
 * selection), move the caret past it, and fire an `input` event so Svelte's
 * `bind:value` and the field's `oninput` (autosave) pick it up. Used by the
 * symbols palette to insert a glyph into whichever field was last focused —
 * inputs keep their `selectionStart`/`End` after blur, so this works even though
 * clicking a palette chip moved focus away.
 */
export function insertAtCaret(el: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  el.value = el.value.slice(0, start) + text + el.value.slice(end);
  const caret = start + text.length;
  el.focus();
  el.setSelectionRange(caret, caret);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
