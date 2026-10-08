/**
 * Keep a textarea as tall as the text inside it, so every line is on show and the
 * box never scrolls against itself.
 *
 * The action takes the field's value as its parameter: Svelte assigns to the `value`
 * *property*, which changes no attribute and fires no input event, so a value that
 * arrives from undo, a variant switch or a history restore reaches the action only
 * through `update`. That runs before the property is committed, so the refit waits a
 * frame — measuring first would read the height the old text needed.
 *
 * Width changes the wrap, so a narrower box needs more rows. Only width is watched:
 * refitting on the height this very function sets would chase its own tail.
 */
export function autogrow(el: HTMLTextAreaElement) {
  let lastWidth = 0;

  const fit = () => {
    el.style.height = 'auto';
    el.style.height = `${String(el.scrollHeight)}px`;
  };
  const refit = () => requestAnimationFrame(fit);

  fit();
  el.addEventListener('input', fit);

  const observer = new ResizeObserver((entries) => {
    const width = entries[0].contentRect.width;
    if (width === lastWidth) return;
    lastWidth = width;
    fit();
  });
  observer.observe(el);

  return {
    update: refit,
    destroy() {
      observer.disconnect();
      el.removeEventListener('input', fit);
    },
  };
}
