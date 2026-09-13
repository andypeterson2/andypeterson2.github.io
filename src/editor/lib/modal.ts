/**
 * Make an in-page panel modal: everything outside it goes inert (no focus, no
 * clicks, hidden from screen readers), focus moves in, and on release the page
 * comes back and focus returns to whatever opened the panel.
 *
 * Why not <dialog>.showModal(): a modal dialog renders in the top layer, outside
 * the root element's filter — and dark mode *is* a filter on <html>, so a native
 * modal would stay light on a dark page.
 */
export function holdModal(panel: HTMLElement, focusTarget?: HTMLElement | null): () => void {
  const active = document.activeElement;
  const opener = active instanceof HTMLElement && active !== document.body ? active : null;

  // Walk from the panel up to <body>, making every sibling along the way inert.
  const made: HTMLElement[] = [];
  let node: HTMLElement = panel;
  let parent = node.parentElement;
  while (parent && node !== document.body) {
    for (const sib of Array.from(parent.children)) {
      if (sib === node || !(sib instanceof HTMLElement) || sib.inert) continue;
      sib.inert = true;
      made.push(sib);
    }
    node = parent;
    parent = node.parentElement;
  }

  // Tab wraps inside the panel instead of leaving for the browser's own chrome.
  const onTab = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const stops = tabStops(panel);
    if (stops.length === 0) return;
    const first = stops[0];
    const last = stops[stops.length - 1];
    const at = document.activeElement;
    if (e.shiftKey && (at === first || !panel.contains(at))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (at === last || !panel.contains(at))) {
      e.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', onTab);

  (focusTarget ?? panel).focus({ preventScroll: true });

  return () => {
    document.removeEventListener('keydown', onTab);
    for (const el of made) el.inert = false;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  };
}

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function tabStops(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (el) => el.tabIndex >= 0 && el.getClientRects().length > 0,
  );
}

/** Svelte action form: `use:modal={'.selector-to-focus'}`. */
export function modal(node: HTMLElement, focus?: string) {
  const release = holdModal(node, focus ? node.querySelector<HTMLElement>(focus) : null);
  return { destroy: release };
}
