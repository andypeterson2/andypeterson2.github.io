/**
 * UI-KIT — Reusable UI behaviours.
 *
 * Opt-in initialisers for common interactive patterns: theme toggle, drawer,
 * dropdown, resize handle, and log terminal. Nothing auto-initialises — the
 * consumer calls what they need.
 *
 * Usage:
 *   import { UIKit } from '../ui-kit/ui-kit';
 *   UIKit.initThemeToggle(document.getElementById('theme-toggle'));
 *   UIKit.initDrawer(drawerEl, handleEl);
 */

import { ICONS } from './icons';

/** Shared theme storage key — must match theme-bootstrap.js. */
const THEME_KEY = 'sm-theme';

export interface ThemeToggleOpts {
  /** localStorage key (default: THEME_KEY). */
  key?: string;
  /** HTML for the "switch to dark" icon. */
  darkIcon?: string;
  /** HTML for the "switch to light" icon. */
  lightIcon?: string;
}

export interface ThemeToggleHandle {
  setTheme(t: string): void;
  destroy(): void;
}

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
  THEME_KEY: string;
  ICONS: typeof ICONS;
  initThemeToggle(el: HTMLElement, opts?: ThemeToggleOpts | string): ThemeToggleHandle;
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
// THEME TOGGLE
// ═══════════════════════════════════════════════════════════════════════════

/** Initialise a dark/light theme toggle button. */
function initThemeToggle(el: HTMLElement, opts: ThemeToggleOpts | string = {}): ThemeToggleHandle {
  // Backwards compat: accept string as second arg (legacy key param)
  const o: ThemeToggleOpts = typeof opts === 'string' ? { key: opts } : opts;
  const key = o.key ?? THEME_KEY;
  const darkIcon = o.darkIcon ?? ICONS.moon;
  const lightIcon = o.lightIcon ?? ICONS.sun;

  function apply(theme: string): void {
    document.documentElement.dataset.theme = theme;
    el.innerHTML = theme === 'light' ? darkIcon : lightIcon;
    el.setAttribute(
      'aria-label',
      theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode',
    );
  }

  function onClick(): void {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    apply(next);
    localStorage.setItem(key, next);
  }

  apply(localStorage.getItem(key) ?? document.documentElement.dataset.theme ?? 'light');
  el.addEventListener('click', onClick);

  return {
    setTheme: apply,
    destroy() {
      el.removeEventListener('click', onClick);
    },
  };
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

  // Set ARIA roles for accessibility
  menuEl.setAttribute('role', 'listbox');
  for (const item of menuItems()) item.setAttribute('role', 'option');

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

  // Restore persisted width
  if (storageKey) {
    const saved = parseInt(localStorage.getItem(storageKey) ?? '');
    targetEl.style.width = String(!isNaN(saved) ? saved : def) + 'px';
  } else {
    targetEl.style.width = String(def) + 'px';
  }

  handleEl.addEventListener('mousedown', (e) => {
    e.preventDefault();
    document.body.classList.add('resize-dragging');
    handleEl.classList.add('dragging');
    const startX = e.clientX;
    const startW = targetEl.getBoundingClientRect().width;

    function onMove(ev: MouseEvent): void {
      const bounds = containerEl.getBoundingClientRect();
      const maxW = opts.max ?? bounds.width - min;
      const newW = Math.max(min, Math.min(maxW, startW + (ev.clientX - startX)));
      targetEl.style.width = String(newW) + 'px';
      if (storageKey) localStorage.setItem(storageKey, String(Math.round(newW)));
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
  THEME_KEY,
  ICONS,
  initThemeToggle,
  initDrawer,
  initDropdown,
  onEscape,
  initResize,
  createLogger,
};

window.UIKit = UIKit;
