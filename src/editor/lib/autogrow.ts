/**
 * Keep a textarea as tall as the text inside it, so every line is on show and the
 * box never scrolls against itself. Height is cleared before it is read, because
 * scrollHeight only shrinks once the element stops holding the old height open.
 */
export function autogrow(el: HTMLTextAreaElement) {
  const fit = () => {
    el.style.height = 'auto';
    el.style.height = `${String(el.scrollHeight)}px`;
  };
  fit();
  el.addEventListener('input', fit);
  // The value can change without a keystroke (undo, a variant switch, a restore).
  const observer = new MutationObserver(fit);
  observer.observe(el, { attributes: true, attributeFilter: ['value'] });
  return {
    update: fit,
    destroy() {
      observer.disconnect();
      el.removeEventListener('input', fit);
    },
  };
}
