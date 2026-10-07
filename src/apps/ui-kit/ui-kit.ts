/**
 * Interactive behaviours the classifier page composes. Nothing auto-initialises
 * — the page calls what it needs, and each initialiser wires its own listeners
 * for the life of the page.
 */

/** A dropdown the page can shut from elsewhere — its trigger owns opening. */
export interface DropdownHandle {
  close(): void;
}

// DRAWER

// DROPDOWN

/** Initialise a dropdown (toggle + click-outside-to-close + keyboard a11y). */
export function initDropdown(triggerEl: HTMLElement, menuEl: HTMLElement): DropdownHandle {
  function open(): void {
    menuEl.classList.remove('hidden');
    triggerEl.setAttribute('aria-expanded', 'true');
  }
  function close(): void {
    menuEl.classList.add('hidden');
    triggerEl.setAttribute('aria-expanded', 'false');
  }

  function onTrigger(e: MouseEvent): void {
    e.stopPropagation();
    if (menuEl.classList.contains('hidden')) open();
    else close();
  }
  function onOutside(e: MouseEvent): void {
    if (e.target instanceof Node && !menuEl.contains(e.target) && e.target !== triggerEl) {
      close();
    }
  }

  function menuItems(): HTMLElement[] {
    return Array.from(menuEl.querySelectorAll<HTMLElement>('.ui-dropdown-item'));
  }

  // Key dispatch while the menu is open: Escape closes, arrows cycle focus,
  // Enter/Space activates the focused item.
  function onOpenKeydown(e: KeyboardEvent): void {
    const items = menuItems();
    if (items.length === 0) return;
    const idx = items.indexOf(document.activeElement as HTMLElement);

    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      triggerEl.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[idx < items.length - 1 ? idx + 1 : 0]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[idx > 0 ? idx - 1 : items.length - 1]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (idx !== -1) items[idx]?.click();
      close();
      triggerEl.focus();
    }
  }

  function onKeydown(e: KeyboardEvent): void {
    const isOpen = !menuEl.classList.contains('hidden');
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        open();
        menuEl.querySelector<HTMLElement>('.ui-dropdown-item')?.focus();
      }
      return;
    }
    onOpenKeydown(e);
  }

  // No ARIA roles: this is a disclosure of plain buttons.
  // The trigger's aria-expanded and aria-controls say all there is to say.

  triggerEl.addEventListener('click', onTrigger);
  triggerEl.addEventListener('keydown', onKeydown);
  menuEl.addEventListener('keydown', onKeydown);
  document.addEventListener('click', onOutside);

  return { close };
}

// ESCAPE KEY

const escapeCallbacks: (() => void)[] = [];
let escapeListenerAttached = false;

/** Register a callback for the Escape key. Returns an unsubscribe function. */
export function onEscape(callback: () => void): () => void {
  if (!escapeListenerAttached) {
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      for (const cb of escapeCallbacks) cb();
    });
    escapeListenerAttached = true;
  }
  escapeCallbacks.push(callback);
  return () => {
    const idx = escapeCallbacks.indexOf(callback);
    if (idx !== -1) escapeCallbacks.splice(idx, 1);
  };
}

// RESIZE HANDLE
