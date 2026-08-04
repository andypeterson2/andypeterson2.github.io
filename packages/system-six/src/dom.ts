/** Tiny DOM helpers shared by the elements. No framework, no styling. */

/** Create an element with an optional class and text. */
export function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * Move a host's existing light-DOM children into a target — the light-DOM
 * "slot" projection. Called once, when the element wraps itself in its chrome.
 */
export function projectChildren(from: Element, to: Element): void {
  const frag = document.createDocumentFragment();
  while (from.firstChild) frag.appendChild(from.firstChild);
  to.appendChild(frag);
}

/**
 * Run `fn` once the DOM is ready to read children — immediately if parsing has
 * finished, else at DOMContentLoaded. This makes a light-DOM element that
 * projects children robust to WHEN its bundle loads: if the parser is still
 * adding this element's children (bundle loaded early/synchronously), we wait;
 * if the element was inserted after load, we run now.
 */
export function onReady(fn: () => void): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}
