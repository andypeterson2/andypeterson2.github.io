/**
 * UI-KIT — Reusable UI behaviours.
 *
 * Opt-in initialisers for common interactive patterns: drawer, dropdown, resize
 * handle, and log terminal. Nothing auto-initialises — the consumer calls what
 * they need.
 *
 * Usage:
 *   import { UIKit } from '../ui-kit/ui-kit';
 *   UIKit.initDrawer(drawerEl, handleEl);
 */

export interface DrawerHandle {
  open(): void;
  close(): void;
  toggle(): void;
  destroy(): void;
}

export interface DropdownHandle {
  open(): void;
  close(): void;
  destroy(): void;
}

export interface ResizeOpts {
  /** Minimum width in px (default 180). */
  min?: number;
  /** Maximum width (defaults to container width − min). */
  max?: number;
  /** Default width if nothing persisted (default 300). */
  default?: number;
  /** localStorage key for persistence. */
  key?: string;
}

export type Logger = (msg: string, level?: string) => void;

export interface UiKitApi {
  initDrawer(drawerEl: HTMLElement, handleEl: HTMLElement): DrawerHandle;
  initDropdown(triggerEl: HTMLElement, menuEl: HTMLElement): DropdownHandle;
  onEscape(callback: () => void): () => void;
  initResize(
    handleEl: HTMLElement,
    targetEl: HTMLElement,
    containerEl: HTMLElement,
    opts?: ResizeOpts,
  ): void;
  createLogger(terminalEl: HTMLElement, max?: number): Logger;
}

// ═══════════════════════════════════════════════════════════════════════════
// DRAWER
// ═══════════════════════════════════════════════════════════════════════════

/** Initialise a collapsible drawer (adds/removes `.open` class). */
function initDrawer(drawerEl: HTMLElement, handleEl: HTMLElement): DrawerHandle {
  function open(): void {
    drawerEl.classList.add('open');
    handleEl.setAttribute('aria-expanded', 'true');
  }
  function close(): void {
    drawerEl.classList.remove('open');
    handleEl.setAttribute('aria-expanded', 'false');
  }
  function toggle(): void {
    if (drawerEl.classList.contains('open')) close();
    else open();
  }

  handleEl.addEventListener('click', toggle);

  return {
    open,
    close,
    toggle,
    destroy() {
      handleEl.removeEventListener('click', toggle);
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DROPDOWN
// ═══════════════════════════════════════════════════════════════════════════

/** Initialise a dropdown (toggle + click-outside-to-close + keyboard a11y). */
function initDropdown(triggerEl: HTMLElement, menuEl: HTMLElement): DropdownHandle {
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

  // No ARIA roles: this is a disclosure of plain buttons, not a listbox or menu widget.
  // The trigger's aria-expanded and aria-controls say all there is to say.

  triggerEl.addEventListener('click', onTrigger);
  triggerEl.addEventListener('keydown', onKeydown);
  menuEl.addEventListener('keydown', onKeydown);
  document.addEventListener('click', onOutside);

  return {
    open,
    close,
    destroy() {
      triggerEl.removeEventListener('click', onTrigger);
      triggerEl.removeEventListener('keydown', onKeydown);
      menuEl.removeEventListener('keydown', onKeydown);
      document.removeEventListener('click', onOutside);
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ESCAPE KEY
// ═══════════════════════════════════════════════════════════════════════════

const escapeCallbacks: (() => void)[] = [];
let escapeListenerAttached = false;

/** Register a callback for the Escape key. Returns an unsubscribe function. */
function onEscape(callback: () => void): () => void {
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

// ═══════════════════════════════════════════════════════════════════════════
// RESIZE HANDLE
// ═══════════════════════════════════════════════════════════════════════════

/** Initialise a drag-to-resize handle for a split layout. */
function initResize(
  handleEl: HTMLElement,
  targetEl: HTMLElement,
  containerEl: HTMLElement,
  opts: ResizeOpts = {},
): void {
  const min = opts.min ?? 180;
  const def = opts.default ?? 300;
  const storageKey = opts.key ?? null;

  const clamp = (w: number): number => {
    const maxW = opts.max ?? containerEl.getBoundingClientRect().width - min;
    return Math.max(min, Math.min(maxW, w));
  };

  // A width saved on a wider window can't push the other column off this one.
  let saved = NaN;
  try {
    saved = storageKey ? parseInt(localStorage.getItem(storageKey) ?? '', 10) : NaN;
  } catch {
    /* storage blocked: use the default */
  }
  targetEl.style.width = String(clamp(isNaN(saved) ? def : saved)) + 'px';

  handleEl.addEventListener('mousedown', (e) => {
    e.preventDefault();
    document.body.classList.add('resize-dragging');
    handleEl.classList.add('dragging');
    const startX = e.clientX;
    const startW = targetEl.getBoundingClientRect().width;

    function onMove(ev: MouseEvent): void {
      const newW = clamp(startW + (ev.clientX - startX));
      targetEl.style.width = String(newW) + 'px';
      try {
        if (storageKey) localStorage.setItem(storageKey, String(Math.round(newW)));
      } catch {
        /* storage blocked: the width lasts for this page only */
      }
    }
    function onUp(): void {
      handleEl.classList.remove('dragging');
      document.body.classList.remove('resize-dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// LOG TERMINAL
// ═══════════════════════════════════════════════════════════════════════════

/** Create a log appender for a `.log-terminal` element. */
function createLogger(terminalEl: HTMLElement, max = 200): Logger {
  return function addLog(msg, level) {
    const time = new Date().toTimeString().slice(0, 8);
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const t = document.createElement('span');
    t.className = 'log-time';
    t.textContent = time;
    const m = document.createElement('span');
    m.className = 'log-msg' + (level ? ' log-' + level : '');
    m.textContent = msg;
    entry.appendChild(t);
    entry.appendChild(m);
    terminalEl.appendChild(entry);
    while (terminalEl.children.length > max && terminalEl.firstChild) {
      terminalEl.removeChild(terminalEl.firstChild);
    }
    terminalEl.scrollTop = terminalEl.scrollHeight;
  };
}

// ═══════════════════════════════════════════════════════════════════════════

export const UIKit: UiKitApi = {
  initDrawer,
  initDropdown,
  onEscape,
  initResize,
  createLogger,
};

window.UIKit = UIKit;
